import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),

      // server-only 는 클라이언트에서 import 하면 던지는 가드입니다.
      // Next.js 는 서버 빌드에서 이걸 빈 모듈(empty.js)로 바꿔치기하는데,
      // vitest 는 그 조건을 모릅니다. 테스트는 서버 코드를 서버처럼
      // 돌리는 것이므로 같은 빈 모듈을 가리킵니다.
      "server-only": path.resolve(
        import.meta.dirname,
        "./node_modules/server-only/empty.js",
      ),
    },
  },
});
