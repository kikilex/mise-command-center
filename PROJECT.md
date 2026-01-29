# Mise Command Center - Project Documentation

> **IMPORTANT**: Read this document before making ANY changes to the codebase.

## Tech Stack

### Core
- **Framework**: Next.js 16.1.6 (App Router)
- **React**: 19.2.3
- **TypeScript**: 5.x
- **Styling**: Tailwind CSS 4.x

### UI Components
- **Primary UI Library**: HeroUI (@heroui/react ^2.8.7)
  - Use HeroUI components for: Button, Modal, Input, Card, Chip, Dropdown, etc.
  - Docs: https://heroui.com
- **Animations**: Framer Motion (^12.29.2)

### Icons
- **PRIMARY: Lucide React** (`lucide-react ^0.563.0`) ⚠️ USE THIS
  - Import from: `'lucide-react'`
  - Example: `import { FileText, Plus, Search } from 'lucide-react'`
- **LEGACY: Heroicons** (`@heroicons/react ^2.2.0`) ⚠️ DO NOT ADD MORE
  - Some old components still use this - migrate away when touching those files
  - DO NOT add new Heroicons imports

### Backend
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth with SSR (@supabase/ssr)
- **Client**: @supabase/supabase-js ^2.93.2

### Other Libraries
- **Toast Notifications**: react-hot-toast (^2.6.0)
- **Markdown Rendering**: react-markdown (^10.1.0) with remark-gfm
- **Syntax Highlighting**: react-syntax-highlighter (^16.1.0)
- **Theming**: next-themes (^0.4.6) - dark/light mode

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── tasks/         # Task-related APIs
│   │   ├── calendar/      # Calendar APIs
│   │   └── content/       # Content pipeline APIs
│   ├── auth/callback/     # Auth callback handler
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   ├── tasks/             # Tasks page (Kanban + List views)
│   ├── calendar/          # Calendar view
│   ├── content/           # Content pipeline
│   ├── docs/              # Document pages
│   │   ├── [id]/          # Document viewer
│   │   │   └── edit/      # Document editor
│   │   └── page.tsx       # Document list
│   ├── ai/                # AI agent management
│   ├── business/          # Business dashboard
│   ├── family/            # Family/personal dashboard
│   ├── notes/             # Notes
│   ├── projects/          # Projects
│   ├── settings/          # App settings
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home/dashboard
│   └── providers.tsx      # Context providers
├── components/            # Reusable components
│   ├── Navbar.tsx         # Main navigation
│   ├── TaskDetailModal.tsx # Task detail modal
│   ├── TaskDocuments.tsx  # Documents linked to task
│   ├── FileViewerModal.tsx # File viewer modal
│   ├── NotificationBell.tsx # Notification dropdown
│   ├── BusinessSelector.tsx # Business context switcher
│   ├── UserMenu.tsx       # User dropdown menu
│   ├── ThemeToggle.tsx    # Dark/light mode toggle
│   ├── WorkLogPanel.tsx   # AI work log display
│   ├── PromptsSection.tsx # Content prompts
│   └── ...Modal.tsx       # Various modals
└── lib/                   # Utilities and contexts
    ├── supabase/          # Supabase client setup
    │   ├── client.ts      # Browser client
    │   ├── server.ts      # Server client
    │   └── middleware.ts  # Auth middleware
    ├── business-context.tsx # Business context provider
    ├── menu-settings.tsx  # Menu customization
    ├── icons.tsx          # Icon definitions (Lucide)
    ├── errors.ts          # Error handling
    └── version.ts         # App version
```

## Database Schema (Supabase)

### Tables
- **users** - User profiles
- **businesses** - Business entities
- **business_members** - User-business relationships
- **tasks** - Tasks with Kanban support
- **task_files** - File attachments for tasks
- **task_comments** - Task comments
- **task_feedback** - Task feedback
- **documents** - Markdown documents (linked to tasks)
- **document_comments** - Comments on documents
- **content_items** - Content pipeline items
- **content_prompts** - Content generation prompts
- **content_templates** - Content templates
- **products** - Products for sales tracking
- **sales** - Sales records
- **projects** - Projects
- **project_members** - Project memberships
- **notes** - Notes
- **notifications** - User notifications
- **ai_agents** - AI agent configurations
- **ai_work_log** - AI agent activity log

### Key Fields

#### tasks
- `id`, `title`, `description`, `status` (todo/in_progress/in_review/done)
- `priority` (low/medium/high/urgent)
- `ai_flag` (boolean) - assigned to AI
- `ai_agent` (text) - which AI agent (e.g., "ax")
- `assignee_id`, `created_by`, `business_id`
- `due_date`, `estimated_minutes`, `actual_minutes`

#### documents
- `id`, `title`, `content` (markdown)
- `task_id` (FK to tasks, nullable)
- `business_id`, `created_by`
- `status` (draft/in_review/approved/needs_revision)
- `version` (integer)

## Coding Standards

### Icons
```tsx
// ✅ CORRECT - Use Lucide
import { FileText, Plus, Search, Edit, Trash2 } from 'lucide-react'

// ❌ WRONG - Don't add new Heroicons
import { PlusIcon } from '@heroicons/react/24/outline'
```

### Components
```tsx
// ✅ CORRECT - Use HeroUI components
import { Button, Modal, Input, Card, Chip } from '@heroui/react'

// Components should be responsive (mobile-first)
// Use Tailwind for custom styling
```

### API Calls
```tsx
// Use the Supabase client from lib/supabase
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const { data, error } = await supabase.from('tasks').select('*')
```

### Dark Mode
- Use Tailwind's dark: prefix
- Or use next-themes for programmatic access
- Test both light and dark modes

## Common Patterns

### Creating a Modal
```tsx
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'

<Modal isOpen={isOpen} onClose={onClose}>
  <ModalContent>
    <ModalHeader>Title</ModalHeader>
    <ModalBody>Content</ModalBody>
    <ModalFooter>
      <Button onPress={onClose}>Close</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

### Using Toast
```tsx
import toast from 'react-hot-toast'

toast.success('Task created!')
toast.error('Something went wrong')
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

## Deployment

- **Platform**: Vercel
- **URL**: https://mise-command-center.vercel.app
- **Git**: Push to main triggers auto-deploy

## ⚠️ Don't Revert These Fixes

These are intentional simplifications. Do NOT add back removed features:

1. **Docs "Awaiting Approval" banner** (`src/app/docs/[id]/page.tsx`)
   - Keep it simple: just "Awaiting Approval" text + Approve button
   - NO description text like "This document is ready for review..."
   - NO redundant "In Review" status chip when banner is shown

2. **Status chips** - Hide when a banner already communicates the status

3. **Calendar dropdown in Command Center** - Only show valid calendars: `Ax`, `Alex's Work`, `Mise Family`

---

## Known Issues / Tech Debt

1. **Mixed icon libraries** - Some components still use Heroicons, should migrate to Lucide
2. **RLS policies** - Some queries need service role key due to RLS complexity

## Last Updated
2026-01-29
