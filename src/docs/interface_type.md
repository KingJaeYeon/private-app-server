## 아래 규칙을 지켜서 interface 와 type 을 선택하세요

다만 이 프로젝트에서는 swagger + nestjs plugIn 사용 중이라 response dto 를 필요로 합니다.


### Interface의 강점: 확장과 상속

```ts
// 1. API 응답처럼 확장 가능성이 높은 객체 구조
interface ApiResponse {
    status: number;
    message: string;
}

interface DetailedApiResponse extends ApiResponse {
    data: unknown;
    timestamp: Date;
}

interface PaginatedApiResponse extends DetailedApiResponse {
    page: number;
    totalPages: number;
    hasNext: boolean;
}

// 2. 플러그인이나 외부에 공개되는 API 
interface Plugin {
    init(): void;
    destroy(): void;
}

// 3. DB 엔티티처럼 명확한 스키마가 있는 객체
interface User {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
}

// 4. DTO (Data Transfer Object)
interface CreateUserDto {
    name: string;
    email: string;
    password: string;
}
```

### Type의 강점: 유연성과 정교한 타입 정의

```ts
// 1. 튜플 타입 정의
type Point = [number, number];
type RGB = [number, number, number];
type StateChange = [string, any]; // [key, value]

// 2. 유니온 타입으로 정확한 값 제한
type Status = 'idle' | 'loading' | 'success' | 'error';
type Theme = 'light' | 'dark' | 'system';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// 3. 유틸리티 타입을 활용한 변환
interface User {
    id: number;
    name: string;
    email: string;
    password: string;
}

type CreateUser = Omit<User, 'id'>;
type UpdateUser = Partial<Pick<User, 'name' | 'email'>>;
type SafeUser = Omit<User, 'password'>;

// 4. 템플릿 리터럴 타입
type CssUnit = `${number}px` | `${number}rem` | `${number}em`;
type EventName = `user:${string}`;
```