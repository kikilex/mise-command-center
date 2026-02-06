# Fixes Round 2 - Alex's Feedback (2026-02-04)

## Agent 1: Dashboard (src/app/page.tsx) [x]

### What's Next Widget [x]
- **TOP 3 ONLY** — Currently shows 7 tasks grouped by project. Change to show exactly 3 highest-priority tasks. No project grouping on dashboard.
- **Due Today tab** — Add a small tab/toggle next to "What's Next" that switches between "Top 3 Priorities" and "Due Today" views
- Remove the `groupedTasks` logic that groups by project. Just show a flat list of top 3.

### Agent Modal (Message Button) [x]
- In the agent detail modal (the one that opens when you click an agent on dashboard), add a **message icon button** (MessageCircle)
- Clicking it should dispatch `window.dispatchEvent(new CustomEvent('open-chat-thread', { detail: { recipient: agent.slug } }))` to open ChatWidget with a new message to that agent

### Agent Modal (Profile Picture) [x] 
- The EditAgentModal component exists at `src/components/EditAgentModal.tsx`
- Add a small "Edit Profile" or gear icon button in the agent modal header that opens EditAgentModal
- Import EditAgentModal and wire it up

### Brain Dump Thread Title [x]
- When `handleOrganize()` creates a new inbox message, add a `subject` field: `Brain Dump - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
- Also generate a proper `thread_id`: `braindump-${Date.now()}`

---

## Agent 2: ChatWidget (src/components/ChatWidget.tsx) [x]

### Thread List Text Size [x]
- In the sidebar thread list, increase the text size by 2pts
- Currently the thread name is `text-sm` (~14px) — change to `text-base` (~16px)  
- The preview text is `text-sm` — change to `text-[15px]`
- The recipient label `text-xs` is fine

### Unread Badge on Chat Bubble [x]
- Add a red badge/dot on the main ChatWidget floating button (the MessageCircle button that opens the widget)
- Count unread messages: query inbox where `to_recipient = current_user_name` and `status = 'pending'` and `item_type = 'message'`
- Show count as a small red circle with number overlaid on the chat button
- Poll every 30 seconds or use Supabase realtime subscription

### Realtime Messages [x]
- Add a Supabase realtime subscription on the `inbox` table
- When new messages arrive for the active thread, append them to the messages list
- This way the user doesn't need to refresh to see new messages
- Subscribe to INSERT events on `inbox` where `thread_id` matches active thread

---

## Agent 3: Spaces Detail (src/app/spaces/[id]/page.tsx) [x]

### Zero Members Bug [x]
- The query is `supabase.from('space_members').select('*, users(*)').eq('space_id', id)`
- The `users(*)` join likely fails because `space_members` has a foreign key `user_id` referencing `auth.users`, NOT the public `users` table
- Fix: Change the query to join with the public users table properly. Try: `supabase.from('space_members').select('*, user:users!space_members_user_id_fkey(*)').eq('space_id', id)`
- OR do a separate query: fetch space_members, then fetch users by their IDs
- Also check if the userRoleRes query is blocking — it requires `user?.id` which may be null on first render. Add a guard.

### Invite Button Missing [x]
- The `InviteMemberModal` is imported and the disclosure hooks exist (`isInviteOpen`, `onInviteOpen`, `onInviteClose`)
- Check if there's actually a button that calls `onInviteOpen` in the Members tab
- If not, add one: In the Members tab header, add a Button with `startContent={<Plus />}` text "Invite Member" that calls `onInviteOpen`
- Make sure `<InviteMemberModal isOpen={isInviteOpen} onClose={onInviteClose} spaceId={id as string} onMemberAdded={loadSpaceData} />` is rendered

### Doc Back Navigation [x] 
- When clicking a doc from the space detail page (Documents tab), we navigate to `/docs/${doc.id}`
- The back arrow in `/docs/[id]/page.tsx` currently does `router.back()` or `router.push('/docs')`
- Fix: When navigating TO a doc from a space, add query param: `router.push(`/docs/${doc.id}?from=space&spaceId=${id}&tab=docs`)`
- In the doc detail page, check for `from=space` param and use it for the back button
- This is a cross-file change — update BOTH `src/app/spaces/[id]/page.tsx` (the link) AND `src/app/docs/[id]/page.tsx` (the back button)

### Remove confirm() for Member Removal [x]
- Currently uses `if (!confirm('Are you sure...'))` — replace with inline confirmation like other parts of the app
- Use a state variable `removingMemberId` (already exists!) to show inline "Remove? Yes/No" buttons

---

## Agent 4: Task Detail (src/components/TaskDetailModal.tsx) [x]

### Markdown Rendering [x]
- Currently description shows as: `<p className="whitespace-pre-wrap">{formData.description}</p>`
- Replace with ReactMarkdown: `<ReactMarkdown remarkPlugins={[remarkGfm]}>{formData.description || ''}</ReactMarkdown>`
- Add imports: `import ReactMarkdown from 'react-markdown'` and `import remarkGfm from 'remark-gfm'`
- Add appropriate prose styling

### Inline Priority Editing (Read-Only Mode) [x]
- Currently priority is just a static Chip in read-only mode (line ~735 area)
- Replace with a small Select dropdown (like status already has) that auto-saves on change
- Same pattern as the status Select that's already working in read-only mode

### Inline Due Date Editing (Read-Only Mode) [x]
- Currently shows as plain text: `{formData.due_date ? new Date(formData.due_date).toLocaleDateString() : 'No due date'}`
- Replace with an inline date Input that auto-saves on change
- Use: `<Input type="date" size="sm" value={formData.due_date} onChange={...} />` with auto-save

### Space Name Instead of ID [x]
- Currently: `{formData.space_id ? 'Space ' + formData.space_id.substring(0, 8) + '...' : 'No space'}`
- Fix: The component needs access to spaces data. Add a spaces fetch in `loadDropdownData` or accept spaces as a prop.
- Fetch spaces: `const { data: spacesData } = await supabase.from('spaces').select('id, name')`
- Store in state and display the space name

### Auto-Close Modal After Assign [x]
- In `handleAssignTo`, after success, call `onClose()` to close the modal
- Add `onClose()` after `onTaskUpdated()`

### Edit Button - Icon Only [x]
- The edit button currently has SVG + "Edit" text
- Remove the text, make it `isIconOnly`: `<Button isIconOnly size="sm" variant="flat" onPress={() => setIsEditing(true)}><Pencil className="w-4 h-4" /></Button>`
- Import Pencil from lucide-react (already imported at top)

---

## Agent 5: Docs (src/app/docs/page.tsx + src/app/docs/[id]/page.tsx) [x]

### Notes vs Docs Tabs [x]
- Add small filter tabs at the top: "All" | "Documents" | "Notes"  
- Filter by `doc_type` field ('document' or 'note')
- Use simple Button group or Tabs component

### Simplified Buttons [x]
- Replace current header buttons with just two: `+ Doc` and `+ Note`
- Make them clean, small buttons with Plus icon

### Quick Note Modal [x]
- When clicking "+ Note", open a modal (NOT navigate to a new page)
- Modal should have: title input + textarea for content
- Save directly to `documents` table with `doc_type: 'note'`
- No markdown textarea — just a plain textarea
- After save, close modal and refresh list

### Doc Detail - Back Arrow Fix [x]
- In `src/app/docs/[id]/page.tsx`, read URL search params for `from`, `spaceId`, `tab`
- If `from=space`, back button should go to `/spaces/${spaceId}?tab=${tab || 'docs'}`
- Otherwise default to `/docs`

### Doc Detail - Button Layout Fix [x]
- Fix overlapping buttons in the header
- Edit button should be icon-only (just the pencil icon, no text)
- Ensure proper spacing with `gap-2` between header action buttons
- Dropdown selects should have reasonable max-width

---

## Agent 6: Calendar (src/app/calendar/page.tsx) [x]

### Event Delete [x]
- The delete logic EXISTS in the code (handleDeleteEvent, confirmDeleteEvent)
- Check the API route at `src/app/api/calendar/events/[id]/route.ts` — it uses `supabaseAdmin`
- The delete confirmation UI is inline (shows "Delete? X ✓" overlay on the event)
- Possible issue: the overlay might be too small to click, or z-index issues
- Make the delete confirmation more prominent — maybe use a small Popover or make the inline confirmation bigger
- Also add a Delete button inside the event edit modal (when you click an event to edit it)

### New Event Button - Plus Icon [x]
- Currently: `<Button color="primary" startContent={<Plus />}>New Event</Button>`
- Change to icon-only on mobile, keep text on desktop:
  `<Button color="primary" isIconOnly className="sm:hidden"><Plus /></Button>`
  `<Button color="primary" startContent={<Plus />} className="hidden sm:flex">New Event</Button>`
- OR just simplify to a round + button

---

## IMPORTANT NOTES FOR ALL AGENTS

1. **Use lucide-react for ALL icons** — never heroicons
2. **Use @heroui/react for UI components** — Button, Modal, Select, etc.
3. **Use react-hot-toast** — `toast.success()`, `toast.error()`
4. **DO NOT commit or push** — just make the code changes
5. **DO NOT create new files** unless absolutely necessary
6. **Test your changes compile** — no TypeScript errors
7. **Supabase client**: `import { createClient } from '@/lib/supabase/client'`
