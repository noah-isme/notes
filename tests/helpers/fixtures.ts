/**
 * Test Fixtures & Data Generators
 * Contains reusable mock datasets, boundary values, XSS payloads, SQL injection strings, and unicode samples.
 */

export const FIXTURES = {
  users: {
    validUser1: {
      email: 'alice@example.com',
      password: 'StrongPassword123!',
      rawPassword: 'StrongPassword123!'
    },
    validUser2: {
      email: 'bob@example.com',
      password: 'AnotherSecretPass456!',
      rawPassword: 'AnotherSecretPass456!'
    },
    validUser3: {
      email: 'charlie@example.com',
      password: 'CharliePass789#$',
      rawPassword: 'CharliePass789#$'
    },
    invalidEmails: [
      '',
      'plainaddress',
      '#@%^%#$@#$@#.com',
      '@example.com',
      'Joe Smith <email@example.com>',
      'email.example.com',
      'email@example@example.com',
      'email@example.com (Joe Smith)',
      'email@-example.com',
      'email@example..com'
    ],
    invalidPasswords: [
      '',
      ' ',
      '   ',
      '12345', // Under 6/8 chars
      'short'
    ]
  },
  notes: {
    simple: {
      title: 'Quick Grocery List',
      content: 'Milk, Eggs, Bread, Butter',
      isPinned: false,
      tagNames: ['personal', 'shopping']
    },
    markdownRich: {
      title: 'Sprint Planning & Architecture RFC',
      content: `# Sprint 42 Planning
## Objectives
- Implement **Drizzle ORM** pooling
- Add *Svelte 5* runes UI
- Verify *strict tenant isolation*

### Code Example:
\`\`\`typescript
interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}
\`\`\`

> Note: All queries must enforce compound user ID checks.

1. Review PRs
2. Run test suites
3. Deploy to Vercel`,
      isPinned: true,
      tagNames: ['work', 'architecture', 'sprint']
    },
    boundaryMaxTitle: {
      // Exactly 200 characters
      title: 'A'.repeat(200),
      content: 'Valid note with 200 char title',
      isPinned: false
    },
    boundaryExceededTitle: {
      // 201 characters
      title: 'A'.repeat(201),
      content: 'Invalid note with 201 char title',
      isPinned: false
    },
    hugeContent: {
      title: 'Large Payload Benchmark Note',
      // ~50KB markdown content
      content: '# Benchmark Content\n\n' + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(900),
      isPinned: false
    }
  },
  xssPayloads: [
    {
      name: 'Script tag injection',
      payload: '<script>alert("XSS")</script>',
      description: 'Raw script tag execution'
    },
    {
      name: 'Image onerror handler',
      payload: '<img src="invalid-image.jpg" onerror="alert(\'XSS\')" />',
      description: 'Inline event handler via broken image'
    },
    {
      name: 'Javascript URI link',
      payload: '[Malicious Link](javascript:alert("XSS"))',
      description: 'Javascript pseudo-protocol link'
    },
    {
      name: 'Iframe injection',
      payload: '<iframe src="https://attacker.com/steal-cookie"></iframe>',
      description: 'Hidden iframe for clickjacking/exfiltration'
    },
    {
      name: 'SVG onload handler',
      payload: '<svg onload="alert(\'XSS\')">',
      description: 'SVG element with inline onload script'
    },
    {
      name: 'HTML event handler in tag',
      payload: '<div onmouseover="alert(\'XSS\')">Hover here!</div>',
      description: 'Mouse event handler on standard HTML element'
    },
    {
      name: 'Base64 data URI script',
      payload: '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Click me</a>',
      description: 'Data URI executing base64 encoded HTML/JS'
    }
  ],
  sqlInjectionPayloads: [
    "' OR '1'='1",
    "'; DROP TABLE notes; --",
    "UNION SELECT null, null, null, null, null, null, null--",
    "admin'--",
    "1' AND 1=1 --",
    "'; UPDATE users SET email='hacked@evil.com' WHERE 1=1; --",
    "\" OR \"1\"=\"1"
  ],
  unicodeSamples: [
    {
      name: 'Emojis',
      text: '🚀 Note with rocket, memo 📝, sparkles ✨, and lock 🔒'
    },
    {
      name: 'CJK Characters',
      text: '简体中文笔记 - データベースのテスト - 한국어 메모'
    },
    {
      name: 'Right-to-Left Arabic/Hebrew',
      text: 'ملاحظة باللغة العربية مع نصوص مختلفة שלום עולם'
    },
    {
      name: 'Cyrillic & Special Symbols',
      text: 'Заметка на русском с символами: § ± ≠ ≤ ≥ ‰ ∞ ∑ √ ∫'
    }
  ]
};

/**
 * Generate a unique, collision-free test email address.
 */
export function generateTestEmail(prefix = 'test'): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${randomSuffix}@example.com`;
}
