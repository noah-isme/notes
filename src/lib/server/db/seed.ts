import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as dotenv from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '../auth';
import * as schema from './schema';
import { users, notes, tags, noteTags } from './schema';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgres://moonday:moonday@localhost:5433/moonday';

const sampleUsers = [
  {
    name: 'Demo User',
    email: 'demo@example.com',
    password: 'DemoPassword123!',
    notes: [
      {
        title: '👋 Welcome to your Markdown Notes App',
        isPinned: true,
        tagNames: ['welcome', 'markdown', 'svelte'],
        content: `# Welcome to Your New Workspace! 🎉

This notes app is built with **SvelteKit 2**, **Svelte 5 Runes**, and **PostgreSQL** with **Drizzle ORM**.

---

### ✨ Features Highlights
- **Markdown & Code Highlighting**: Write formatted text, code blocks, lists, and quotes.
- **Organization**: Assign multiple tags, search across titles & contents, and pin important notes to top.
- **Strict Data Isolation**: Your notes are private to your user account.
- **Serverless Ready**: Designed and optimized for zero-latency deployment on **Vercel**.

---

### 📝 Markdown Formatting Demo

Here is a quick demonstration of what you can do:

> "Simplicity is prerequisite for reliability." — *Edsger W. Dijkstra*

#### Task Checklist
- [x] Initialized database schema with Drizzle ORM
- [x] Configured user authentication with scrypt & secure sessions
- [x] Implemented responsive 3-pane layout for desktop and mobile
- [ ] Write your next great idea

#### Code Example
\`\`\`typescript
import { $state, $derived } from 'svelte';

let count = $state(0);
let double = $derived(count * 2);
\`\`\`

Feel free to edit this note, add tags, or create new notes from the sidebar!`,
      },
      {
        title: '📐 System Architecture & Stack Overview',
        isPinned: true,
        tagNames: ['work', 'svelte', 'postgres'],
        content: `## System Architecture & Technical Stack

### 🚀 Frontend
- **Framework**: SvelteKit 2 + Svelte 5 (Runes: \`$state\`, \`$derived\`, \`$props\`, \`$effect\`)
- **Styling**: Modern, responsive, clean CSS design system with desktop 3-pane & mobile drawer
- **Markdown**: Custom isomorphic parser with XSS sanitization

### 🗄️ Backend & Database
- **Database**: PostgreSQL with connection pooling (\`postgres.js\`, \`prepare: false\`)
- **ORM**: Drizzle ORM with Drizzle Kit schema migrations
- **Authentication**: Salted \`scrypt\` password hashing and DB-backed cryptographic sessions

### ☁️ Deployment
- **Adapter**: \`@sveltejs/adapter-vercel\` targeting Node.js 20.x runtime`,
      },
      {
        title: '💡 Feature Ideas & Backlog',
        isPinned: false,
        tagNames: ['ideas', 'work'],
        content: `### 💡 Future Enhancements

1. **Collaboration & Sharing**
   - Public shareable view-only links for specific notes
   - Export note to PDF / Markdown file download

2. **Rich Media**
   - Image attachment upload to S3 / Vercel Blob
   - Audio memo recording

3. **Productivity**
   - Keyboard shortcuts (\`Cmd+K\` quick search, \`Cmd+N\` new note)
   - Note version history and diffing`,
      },
      {
        title: '📝 Quick Markdown Syntax Guide',
        isPinned: false,
        tagNames: ['markdown', 'welcome'],
        content: `## Quick Markdown Guide

### Headers
# Heading 1
## Heading 2
### Heading 3

### Emphasis
*Italic text* or _italic text_
**Bold text** or __bold text__
\`Inline code snippet\`

### Lists
- Bullet item 1
- Bullet item 2
  - Sub-item A
  - Sub-item B

1. Numbered item 1
2. Numbered item 2

### Blockquote
> Multi-line blockquotes are formatted cleanly with a side accent bar.`,
      },
    ],
  },
  {
    name: 'Jane Developer',
    email: 'jane.developer@example.com',
    password: 'NotesPassword2026!',
    notes: [
      {
        title: '🚀 Q4 Sprint Planning & Objectives',
        isPinned: true,
        tagNames: ['work', 'ideas'],
        content: `# Q4 Engineering Goals

- Complete database migration pipeline audit
- Optimize serverless cold start times on Vercel
- Implement end-to-end integration test harnesses
- Polish UI animations and responsive mobile views`,
      },
      {
        title: '📚 Weekly Reading & Research List',
        isPinned: false,
        tagNames: ['personal'],
        content: `### Articles & Papers to Read
- Understanding PostgreSQL Execution Plans and Index Optimization
- Deep Dive into Svelte 5 Fine-Grained Reactivity
- Distributed Systems Patterns in Serverless Edge Environments`,
      },
    ],
  },
];

async function seed() {
  console.log('🌱 [Seed] Connecting to PostgreSQL database...');
  const seedClient = postgres(connectionString, { max: 1, prepare: false });
  const db = drizzle(seedClient, { schema });

  try {
    for (const userData of sampleUsers) {
      console.log(`👤 [Seed] Processing user: ${userData.email}`);

      // 1. Find or create user
      let [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email));

      if (!existingUser) {
        const passwordHash = await hashPassword(userData.password);
        const [newUser] = await db
          .insert(users)
          .values({
            name: userData.name,
            email: userData.email,
            passwordHash,
          })
          .returning();
        existingUser = newUser;
        console.log(`   ✨ Created user: ${userData.email} (${userData.name})`);
      } else {
        if (!existingUser.name && userData.name) {
          await db
            .update(users)
            .set({ name: userData.name, updatedAt: new Date() })
            .where(eq(users.id, existingUser.id));
        }
        console.log(`   ℹ️ User already exists: ${userData.email}`);
      }

      const userId = existingUser.id;

      // 2. Create sample notes and tags
      for (const noteData of userData.notes) {
        // Check if note title exists for this user
        const [existingNote] = await db
          .select()
          .from(notes)
          .where(sql`${notes.userId} = ${userId} AND ${notes.title} = ${noteData.title}`);

        let noteId: string;
        if (!existingNote) {
          const [newNote] = await db
            .insert(notes)
            .values({
              userId,
              title: noteData.title,
              content: noteData.content,
              isPinned: noteData.isPinned,
            })
            .returning();
          noteId = newNote.id;
          console.log(`   📝 Created note: "${noteData.title}"`);
        } else {
          noteId = existingNote.id;
          console.log(`   ℹ️ Note already exists: "${noteData.title}"`);
        }

        // 3. Create and associate tags
        for (const tagName of noteData.tagNames) {
          let [tag] = await db
            .select()
            .from(tags)
            .where(sql`${tags.userId} = ${userId} AND ${tags.name} = ${tagName}`);

          if (!tag) {
            const [newTag] = await db
              .insert(tags)
              .values({
                userId,
                name: tagName,
              })
              .returning();
            tag = newTag;
          }

          // Link note to tag
          await db
            .insert(noteTags)
            .values({
              noteId,
              tagId: tag.id,
            })
            .onConflictDoNothing();
        }
      }
    }

    console.log('\n✅ [Seed] Database seeding completed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔑 DEMO LOGIN CREDENTIALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const u of sampleUsers) {
      console.log(`• Email:    ${u.email}`);
      console.log(`  Password: ${u.password}`);
      console.log('─────────────────────────────────────────────────────');
    }
  } catch (error) {
    console.error('❌ [Seed] Error seeding database:', error);
    process.exit(1);
  } finally {
    await seedClient.end();
  }
}

seed();
