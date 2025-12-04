import * as fs from 'fs';
import { ERROR_CODES, ErrorDefinition } from '@/common/exceptions/error-code'; // ERROR_CODES 타입 임포트

type CategoryGrouped = {
  [category: string]: { [code: string]: ErrorDefinition };
};

// ERROR_CODES를 category 기준으로 그룹화
function groupByCategory(errors: typeof ERROR_CODES): CategoryGrouped {
  const grouped: CategoryGrouped = {};

  Object.entries(errors).forEach(([key, value]) => {
    const category = value.category;
    if (!grouped[category]) grouped[category] = {};
    grouped[category][key] = value;
  });

  return grouped;
}

// Markdown 테이블 생성
function createMarkdownTable(
  errors: { [code: string]: ErrorDefinition },
  includeServerMessage: boolean
): string {
  const header = includeServerMessage
    ? `| Code | HTTP Status | Message | serverMessage |`
    : `| Code | HTTP Status | Message |`;

  const divider = includeServerMessage
    ? `|------|------------|---------|---------------|`
    : `|------|------------|---------|`;

  const rows = Object.entries(errors).map(([key, def]) => {
    return includeServerMessage
      ? `| ${def.code} | ${def.statusCode} | ${def.message} | ${def.serverMessage ?? ''} |`
      : `| ${def.code} | ${def.statusCode} | ${def.message} |`;
  });

  return [header, divider, ...rows].join('\n');
}

// 전체 Markdown 생성
function generateMarkdown(errors: typeof ERROR_CODES) {
  const grouped = groupByCategory(errors);
  let md = `## 🌐 Global & Base Error Codes Documentation\n\n`;
  md += `이 문서는 서비스 API에서 발생 가능한 모든 오류 코드를 정리한 문서입니다.\n\n`;

  for (const [category, errorsInCategory] of Object.entries(grouped)) {
    const includeServerMessage = category === 'GLOBAL';

    md += `<details>\n`;
    md += `<summary>🏷 ${category} Errors</summary>\n\n`;
    md += createMarkdownTable(errorsInCategory, includeServerMessage);
    md += `\n</details>\n\n`;
  }

  md += `> 주의: GLOBAL 에러의 serverMessage는 클라이언트에 노출되지 않으며, 로그 및 모니터링용으로만 사용됩니다.\n`;

  return md;
}

// 파일로 저장
const markdown = generateMarkdown(ERROR_CODES);
fs.writeFileSync('error-codes.md', markdown, 'utf-8');
console.log('✅ error-codes.md 파일이 생성되었습니다.');
