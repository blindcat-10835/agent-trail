import { parseFixture } from '../lib/parseFixture.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

const fixtures = [
  { dir: 'fixtures/openclaw', name: 'conversation', source: 'openclaw' as const },
  { dir: 'fixtures/openclaw', name: 'tool-call', source: 'openclaw' as const },
  { dir: 'fixtures/claude-code', name: 'valid_session', source: 'claude-code' as const },
  { dir: 'fixtures/claude-code', name: 'tool_call_pending', source: 'claude-code' as const },
  { dir: 'fixtures/codex', name: 'standard_session', source: 'codex' as const },
  { dir: 'fixtures/codex', name: 'function_calls', source: 'codex' as const },
];

async function generateGoldenFiles() {
  for (const fixture of fixtures) {
    const inputPath = join(fixture.dir, `${fixture.name}.jsonl`);
    const goldenPath = join(fixture.dir, `${fixture.name}.golden.json`);

    console.log(`Processing ${fixture.name}...`);
    const result = await parseFixture(inputPath, fixture.source);

    // Write golden file with formatted JSON
    writeFileSync(goldenPath, JSON.stringify(result, null, 2));
    console.log(`  ✓ Generated ${goldenPath}`);
  }

  console.log('\nAll golden files generated successfully!');
}

generateGoldenFiles().catch(console.error);
