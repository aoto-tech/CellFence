# CellFence 快速入门

本文是社区提供的简体中文译文。最新说明请参阅[英文 README](../../../README.md)。

CellFence 在代码仓库中检查架构约束。例如，如果一个模块单元要使用另一个单元的代码，通常应通过清单中声明的公开入口。即使代码仍能编译、单元测试也通过，CellFence 也能报告直接导入其他单元私有实现的情况。

## 在空目录中试用

在一个空目录中运行：

```bash
npm install --save-dev cellfence
npx cellfence init                              # writes cellfence.manifest.json
mkdir -p src/example
echo 'export const example = 1;' > src/example/public.ts
npx cellfence check
```

预期输出：

```text
CellFence check passed.
```

`init` 写入起始清单，其中的 `example` 单元负责 `src/example/**`。可以根据实际项目重命名该单元、添加其他单元，再运行 `check` 确认约束符合预期。

## 在已有仓库中试用

在已经包含源文件的仓库根目录运行：

```bash
npm install --save-dev cellfence
npx cellfence init --no-scaffold
npx cellfence check --format markdown
```

`init --no-scaffold` 会尝试从现有源文件推断清单。如果无法识别真实的仓库结构，它会退出，避免生成占位文件或指向不存在文件的示例清单。提交前请审阅生成的 `cellfence.manifest.json`，确认实际需要的单元及其公开入口都已覆盖。

## 版本要求与后续步骤

CellFence 需要 Node.js 20 或更高版本。目前处于预发布阶段（v0.x），清单格式和命令行参数可能随次版本变化。它检查仓库中的架构约束，运行时隔离与功能正确性仍需由独立措施保障。

本地检查结果符合预期后，可按 [CI 接入指南](../../ci.md) 将检查加入持续集成。需要了解推断与静态分析的适用范围时，请参阅[当前限制](../../limitations.md)。
