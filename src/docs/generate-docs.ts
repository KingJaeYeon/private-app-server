import * as fs from 'fs';
import { ERROR_CODES, IErrorDefinition } from '@/common/exceptions/error-code';
import { join } from 'node:path';
import process from 'node:process';
import { readFileSync } from 'node:fs';
import * as yaml from 'js-yaml';
import { IConfigKey } from '@/config/config.interface';
import { AUTH_COOKIE } from '@/common/constants/auth'; // ERROR_CODES 타입 임포트

const YAML_CONFIG_FILENAME = `./src/config/${process.env.NODE_ENV}.yaml`;

const config = (): IConfigKey => {
  const file = readFileSync(join(__dirname, YAML_CONFIG_FILENAME), 'utf8');
  return yaml.load(file) as IConfigKey;
};

type CategoryGrouped = {
  [category: string]: { [code: string]: IErrorDefinition };
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
function createMarkdownTable(errors: { [code: string]: IErrorDefinition }, includeServerMessage: boolean): string {
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
  let md = `<a href="swagger/json" download="api-docs.json">api-docs.json</a>\n\n`;
  md += `<a href="swagger/yaml" download="api-docs.yaml">api-docs.yaml</a>\n\n`;
  md += `## 🎯 API 개요 (Overview)\n\n`;
  md += `이 문서는 Private App 의 주요 백엔드 API 명세입니다. 클라이언트(웹/모바일)가 서버와 통신하는 데 필요한 모든 엔드포인트, 데이터 모델, 그리고 인증 메커니즘을 정의합니다.\n\n\n\n`;

  md += `### 주요 기능\n\n`;
  md += `* {기능 1}: 간결하게 설명\n\n`;
  md += `* {기능 2}: 간결하게 설명\n\n`;
  md += `* {기능 3}: 간결하게 설명\n\n\n\n`;

  md += `## 🔒 인증 (Authentication)\n\n`;
  md += `이 API는 **쿠키(Cookie)**를 기반으로 하는 세션 및 토큰 인증 방식을 사용합니다.\n\n`;

  md += `<details><summary>상세보기</summary>\n\n`;
  md += `### 1. 액세스 토큰 (Access Token)\n\n`;
  md += `* **쿠키 이름:** ${AUTH_COOKIE.ACCESS}\n\n`;
  md += `* **역할:** 모든 보호된 API 엔드포인트에 접근하기 위해 사용됩니다. 토큰의 유효 기간은 비교적 짧습니다.\n\n`;
  md += `* **만료 시 동작:** 토큰이 만료되면, 클라이언트는 자동으로 리프레시 토큰을 사용하여 새 액세스 토큰을 요청해야 합니다.\n\n`;

  md += `### 2. 리프레시 토큰 (Refresh Token)\n\n`;
  md += `* **쿠키 이름:** ${AUTH_COOKIE.REFRESH}\n\n`;
  md += `* **역할:** 액세스 토큰이 만료되었을 때, 새 액세스 토큰을 발급받기 위해 사용됩니다.\n\n`;
  md += `* **보안:** 보안을 위해 HTTP Only 쿠키로 설정되어 자바스크립트 접근이 불가능합니다.</details>\n\n\n\n`;

  md += `
## 📋 성공 응답 구조 (JSON)

모든 성공 응답은 TypeScript 인터페이스 \`SuccessResponse<T>\`를 기반으로 합니다.

\`\`\`json
{
  "success": true,
  "data": T,
  "timestamp": string
}
\`\`\`
<details>
<summary>💡 필드 설명</summary>

| 필드 | 타입 | 필수 여부 | 설명 |
| :--- | :--- | :--- | :--- |
| success | boolean (true로 고정) | 필수 | 요청 처리가 **성공적**이었음을 나타내는 플래그입니다. |
| data | T (제네릭) | 선택적 | 요청의 **핵심 결과 데이터**입니다. 데이터 구조는 엔드포인트에 따라 달라집니다. |
| timestamp | string | 필수 | 서버에서 응답이 생성된 **UTC 시간**입니다. (ISO 8601 형식) |
</details>
\n\n\n\n`;

  md += `
## ⚠️실패시 응답 구조 (JSON)

모든 응답은 TypeScript 인터페이스 \`ErrorResponse\`를 기반으로 합니다.

\`\`\`json
{
  "success": false;
  "statusCode": number;
  "code": string;
  "message": string;
  "details": any | undefined;
  "timestamp": string;
  "path": string;
  "category": 'GLOBAL' | 'BASE';
}
\`\`\`
<details>
<summary>⚠️ 실패 응답 필드 설명</summary>

| 필드 | 타입 | 필수 여부 | 설명 |
| :--- | :--- | :--- | :--- |
| success | boolean (false로 고정) | 필수 | 요청 처리가 **실패**었음을 나타내는 플래그입니다. |
| statusCode | number | 필수 | 요청 처리가 **실패**었음을 나타내는 플래그입니다. 클라이언트 오류(4xx) 또는 서버 오류(5xx)를 나타냅니다.|
| code | string | 필수 | 애플리케이션 정의 **고유 오류 식별 코드**입니다. 클라이언트가 에러 타입을 구분하는 데 사용됩니다.|
| message | string | 필수 | 오류에 대한 간결하고 사람이 읽을 수 있는 **상세 설명**입니다.|
| details | any or undefined | 선택적 | **(선택적)** 오류 유형에 따라 추가적인 디버깅 정보를 담습니다. 유효성 검사 실패 시 유용합니다.|
| timestamp | string | 필수 | 서버에서 응답이 생성된 **UTC 시간**입니다. (ISO 8601 형식) |
| path | string | 필수 | 에러를 발생시킨 **요청 URL 경로**입니다. |
</details>
\n\n\n\n`;

  md += `## 🌐 Global & Base Error Codes Documentation\n\n`;
  md += `서비스 API에서 발생 가능한 모든 오류 코드.\n\n`;

  for (const [category, errorsInCategory] of Object.entries(grouped)) {
    const includeServerMessage = category === 'GLOBAL';

    md += `<details>\n`;
    md += `<summary>🏷 ${category} Errors</summary>\n\n`;
    md += createMarkdownTable(errorsInCategory, includeServerMessage);
    md += `\n</details>\n\n`;
  }

  md += `주의: GLOBAL 에러의 serverMessage는 클라이언트에 노출되지 않으며, 로그 및 모니터링용으로만 사용됩니다.\n`;

  return md;
}

// 파일로 저장
const markdown = generateMarkdown(ERROR_CODES);
const outputPath = join(__dirname, 'swagger-description.md');
fs.writeFileSync(outputPath, markdown, 'utf-8');
console.log('✅ swagger-description.md 파일이 생성되었습니다.');
