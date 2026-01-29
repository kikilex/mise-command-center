import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Gemini API for splitting scripts
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

interface Prompt {
  scene_number: number
  text: string
  duration_seconds: number
  actor_prompt?: string
}

export async function POST(request: NextRequest) {
  try {
    const { content_id, script, actor_prompt_base } = await request.json()

    if (!content_id || !script) {
      return NextResponse.json({ error: 'content_id and script are required' }, { status: 400 })
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    // Call Gemini to split the script into video prompts
    const systemPrompt = `You are a video production editor for TikTok-style testimony videos.
Your job is to split a script into individual video prompts/scenes for AI video generation.

RULES:
- Each prompt should be approximately 7 seconds when spoken (about 15-20 words)
- Keep natural sentence breaks - don't split mid-sentence
- Number of prompts depends on script length (longer scripts = more prompts)
- Each prompt needs a complete, detailed video generation prompt

ACTOR CONTEXT: ${actor_prompt_base || 'Person speaking directly to camera in an intimate, documentary-style setting'}

FOR EACH SCENE, generate a detailed video prompt following this format:
- Dialogue: The exact script text for this scene
- Context & Action: What the actor is doing, their expression, any movements
- Cinematography: Camera angle (medium shot), framing (waist up), movement (static)
- Style & Ambiance: Cinematic iPhone feel, moody lighting, intimate confession booth vibe

Return ONLY valid JSON array with this structure:
[
  {
    "scene_number": 1,
    "text": "The dialogue text here",
    "duration_seconds": 7,
    "actor_prompt": "Full video generation prompt including: Dialogue, Context & Action, Cinematography details, Style & Ambiance. All in one detailed paragraph."
  }
]

The actor_prompt should be a complete, detailed prompt ready for AI video generation (like Veo).
No markdown, no explanation, just the JSON array.`

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\nScript to split:\n${script}`
          }]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Gemini API error:', error)
      return NextResponse.json({ error: 'Failed to call Gemini API' }, { status: 500 })
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse the JSON response
    let prompts: Prompt[]
    try {
      // Clean up potential markdown formatting
      const cleanJson = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      prompts = JSON.parse(cleanJson)
    } catch (e) {
      console.error('Failed to parse Gemini response:', generatedText)
      return NextResponse.json({ error: 'Failed to parse AI response', raw: generatedText }, { status: 500 })
    }

    // Delete existing prompts for this content
    await supabase
      .from('content_prompts')
      .delete()
      .eq('content_id', content_id)

    // Insert new prompts
    const promptsToInsert = prompts.map((p, index) => ({
      content_id,
      scene_number: p.scene_number || index + 1,
      text: p.text,
      duration_seconds: p.duration_seconds || 7,
      actor_prompt: p.actor_prompt || actor_prompt_base || null,
      image_status: 'pending',
    }))

    const { data: insertedPrompts, error: insertError } = await supabase
      .from('content_prompts')
      .insert(promptsToInsert)
      .select()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save prompts' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      prompts: insertedPrompts,
      count: insertedPrompts?.length || 0
    })

  } catch (error) {
    console.error('Split prompts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
