# Markdown Image AI Workflow

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/beiffeng/markdown-image-ai-workflow)
[![VSCode](https://img.shields.io/badge/VSCode-1.79+-green.svg)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **AI驱动的Markdown图片工作流管理专家**  
> 专为Markdown写作打造的AI驱动图片工作流管理工具，集成智能上传、自动同步、多平台适配于一体的现代化解决方案

## ✨ 核心特性

### 🤖 **AI智能化**
- **AI驱动处理** - 智能图片识别、自动路径生成、智能重命名
- **工作流自动化** - 粘贴→处理→上传→替换全流程自动化  
- **智能适配** - 根据项目类型自动选择最佳处理策略

### 🔄 **工作流管理**
- **完整工作流** - 从图片获取到最终发布的端到端处理
- **状态管理** - 实时监控每个步骤的处理状态
- **错误恢复** - 智能故障检测和自动重试机制

### 🚀 **多平台生态**
- **GitHub** - 私有仓库支持，完全掌控（推荐）
- **腾讯云COS** - 国内用户首选，高速稳定
- **阿里云OSS** - 高性能对象存储，适合国内用户
- **七牛云存储** - CDN优化，免费额度，适合个人用户
- **SM.MS** - 传统图床支持（已停止注册）
- **Cloudinary** - 专业 CDN 服务（规划中）

### 🔮 **AI增强特性** 
- **智能标记** - AI自动生成图片alt text和描述
- **内容识别** - 基于图片内容的智能分类和标签
- **工作流优化** - AI学习用户习惯，优化处理流程

## 🚀 快速开始

### 1️⃣ 安装插件

从 VSCode 扩展市场搜索 **"Markdown Image AI Workflow"** 并安装。

### 2️⃣ 配置图片流程（推荐）

使用命令面板 (`Ctrl+Shift+P`) 运行：
```
Markdown Image AI Workflow: 设置推荐配置
```

或手动配置 VSCode 设置：
```json
{
  "markdown.copyFiles.destination": {
    "**/*.md": "assets/${documentBaseName}/"
  },
  "markdown.editor.drop.copyIntoWorkspace": "mediaFiles",
  "markdown.editor.filePaste.copyIntoWorkspace": "mediaFiles"
}
```

### 3️⃣ 选择图床平台

> ⚠️ **重要提醒**：不建议使用 SM.MS，因为该服务已关闭新用户注册功能 (We have disabled the registration feature)，现有用户也受到诸多限制。建议使用 GitHub 作为图床方案。

#### 🔒 GitHub（推荐）
```json
{
  "markdownImageAIWorkflow.provider": "github",
  "markdownImageAIWorkflow.github.repo": "username/your-repo",
  "markdownImageAIWorkflow.github.token": "ghp_your-token-here",
  "markdownImageAIWorkflow.github.branch": "main"
}
```

#### ☁️ 阿里云OSS（高性能）
```json
{
  "markdownImageAIWorkflow.provider": "oss",
  "markdownImageAIWorkflow.oss.accessKeyId": "LTAI5t...",
  "markdownImageAIWorkflow.oss.accessKeySecret": "your-access-key-secret",
  "markdownImageAIWorkflow.oss.bucket": "your-bucket-name",
  "markdownImageAIWorkflow.oss.region": "oss-cn-hangzhou"
}
```

#### ☁️ 腾讯云COS（稳定可靠）
```json
{
  "markdownImageAIWorkflow.provider": "cos",
  "markdownImageAIWorkflow.cos.secretId": "AKxxxxxxxxxxx...",
  "markdownImageAIWorkflow.cos.secretKey": "your-secret-key",
  "markdownImageAIWorkflow.cos.bucket": "your-bucket-1234567890",
  "markdownImageAIWorkflow.cos.region": "ap-guangzhou"
}
```

#### ☁️ 七牛云存储（免费额度）
```json
{
  "markdownImageAIWorkflow.provider": "qiniu",
  "markdownImageAIWorkflow.qiniu.accessKey": "your-access-key",
  "markdownImageAIWorkflow.qiniu.secretKey": "your-secret-key",
  "markdownImageAIWorkflow.qiniu.bucket": "your-bucket",
  "markdownImageAIWorkflow.qiniu.domain": "example.com",
  "markdownImageAIWorkflow.qiniu.zone": "z0"
}
```

#### ❌ SM.MS（不推荐，仅供已有用户）
```json
{
  "markdownImageAIWorkflow.provider": "smms",
  "markdownImageAIWorkflow.smms.token": "your-api-token-here"
}
```

**注意**：SM.MS 已停止新用户注册，且停止匿名上传服务。除非您已有账户和 API Token，否则请使用 GitHub 方案。

### 4️⃣ 开始流畅写作

1. 📝 在 Markdown 文件中写作
2. 📷 粘贴图片 (`Ctrl+V`)
3. ⚡ 自动上传处理
4. 🔗 链接自动替换
5. ✨ 继续专注写作

## 🎮 命令面板

| 命令 | 功能 | 快捷键 |
|------|------|--------|
| `Markdown Image AI Workflow: 检查配置` | 诊断配置问题 | - |
| `Markdown Image AI Workflow: 设置推荐配置` | 一键优化配置 | - |
| `Markdown Image AI Workflow: 上传当前图片` | 手动上传图片 | - |

## ⚙️ 完整配置选项

### 🎛️ 核心配置
```json
{
  // 启用状态
  "markdownImageAIWorkflow.enabled": true,
  
  // 图床选择
  "markdownImageAIWorkflow.provider": "smms", // "smms" | "github" | "cos" | "oss" | "qiniu" | "cloudinary"
  
  // 处理策略  
  "markdownImageAIWorkflow.respectVSCodeConfig": true,
  "markdownImageAIWorkflow.fallbackBehavior": "sameDirectory", // "sameDirectory" | "disable" | "prompt"
  
  // 清理选项
  "markdownImageAIWorkflow.deleteLocalAfterUpload": false
}
```

### 🌐 图床平台配置
```json
{
  // SM.MS 配置
  "markdownImageAIWorkflow.smms.token": "",
  
  // GitHub 配置  
  "markdownImageAIWorkflow.github.repo": "username/repo",
  "markdownImageAIWorkflow.github.token": "ghp_xxxxxxxxxxxx",
  "markdownImageAIWorkflow.github.branch": "main",
  
  // 腾讯云COS 配置
  "markdownImageAIWorkflow.cos.secretId": "AKxxxxxxxxxxx",
  "markdownImageAIWorkflow.cos.secretKey": "xxxxxxxxxxxxxxxx",
  "markdownImageAIWorkflow.cos.bucket": "bucket-name-1234567890",
  "markdownImageAIWorkflow.cos.region": "ap-guangzhou",
  
  // 阿里云OSS 配置
  "markdownImageAIWorkflow.oss.accessKeyId": "LTAI5t...",
  "markdownImageAIWorkflow.oss.accessKeySecret": "xxxxxxxxxxxxxxxx",
  "markdownImageAIWorkflow.oss.bucket": "bucket-name",
  "markdownImageAIWorkflow.oss.region": "oss-cn-hangzhou",
  
  // 七牛云存储 配置
  "markdownImageAIWorkflow.qiniu.accessKey": "xxxxxxxxxxxxxxxx",
  "markdownImageAIWorkflow.qiniu.secretKey": "xxxxxxxxxxxxxxxx",
  "markdownImageAIWorkflow.qiniu.bucket": "bucket-name",
  "markdownImageAIWorkflow.qiniu.domain": "example.com",
  "markdownImageAIWorkflow.qiniu.zone": "z0"
}
```

## 🎨 高级路径配置

支持所有 VSCode 路径变量，实现复杂的文件组织：

```json
{
  "markdown.copyFiles.destination": {
    // 📁 按文档分类
    "**/*.md": "assets/${documentBaseName}/",
    
    // 📅 按项目分类  
    "/blog/**/*.md": "static/images/${documentBaseName}/",
    "/docs/**/*.md": "public/assets/",
    
    // 🏷️ 按类型分类
    "/tutorials/**/*.md": "media/tutorials/${documentDirName}/",
    
    // 📊 统一管理
    "/wiki/**/*.md": "images/"
  }
}
```

### 📖 支持的变量
- `${documentBaseName}` - 文档名（不含扩展名）
- `${documentFileName}` - 完整文档名  
- `${documentDirName}` - 文档目录名
- `${documentWorkspaceFolder}` - 工作区根路径
- `${fileName}` - 图片文件名

## 🚦 状态监控

状态栏实时显示插件状态：

| 状态 | 含义 |
|------|------|
| `🌊 SM.MS` | 正常运行，使用 SM.MS |
| `🌊 GitHub` | 正常运行，使用 GitHub |
| `🌊 腾讯云COS` | 正常运行，使用 腾讯云COS |
| `🌊 阿里云OSS` | 正常运行，使用 阿里云OSS |
| `🌊 七牛云存储` | 正常运行，使用 七牛云存储 |
| `⚙️ 需要配置` | 配置不完整 |
| `⏸️ 已禁用` | 插件已禁用 |
| `✅ 上传成功` | 刚完成上传 |

## 🔧 故障排除

### ❓ 常见问题

<details>
<summary><strong>插件没有响应？</strong></summary>

1. 检查 VSCode 版本（需要 1.79+）
2. 运行"检查配置"命令诊断
3. 查看状态栏显示的状态
4. 检查开发者工具控制台（`Help → Toggle Developer Tools`）
</details>

<details>
<summary><strong>图片没有自动上传？</strong></summary>

1. 确认是在 `.md` 文件中操作
2. 检查图片格式（支持 .png, .jpg, .gif, .webp, .svg）
3. 验证 `markdown.copyFiles.destination` 配置
4. 确认图床服务配置正确
</details>

<details>
<summary><strong>链接替换不准确？</strong></summary>

1. 检查 Markdown 语法是否标准 `![alt](path)`
2. 确认文件名匹配
3. 尝试手动上传命令
4. 查看控制台错误信息
</details>

## 🗺️ 发展路线图

### 🚀 即将到来
- [ ] **Cloudinary 集成** - 专业 CDN 支持 (优先级：高)
- [ ] **更多图床支持** - 替代 SM.MS 的稳定方案
- [ ] **AI 智能标记** - 自动生成图片描述
- [ ] **批量处理** - 一键处理多张图片
- [ ] **历史记录** - 上传历史管理

### 🌟 长远规划  
- [ ] **内容识别** - 基于 AI 的图片分类
- [ ] **多语言描述** - AI 生成多语言 alt text
- [ ] **性能优化** - 图片自动压缩
- [ ] **团队协作** - 共享图床配置

## 🤝 参与贡献

我们欢迎任何形式的贡献！

- 🐛 **报告问题** - [GitHub Issues](https://github.com/beiffeng/markdown-image-ai-workflow/issues)
- 💡 **功能建议** - [GitHub Discussions](https://github.com/beiffeng/markdown-image-ai-workflow/discussions)
- 🔧 **代码贡献** - [Pull Requests](https://github.com/beiffeng/markdown-image-ai-workflow/pulls)

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

## 🙏 特别感谢

- **VSCode 团队** - 提供强大的编辑器平台
- **开源社区** - 提供优秀的依赖库
- **用户反馈** - 帮助我们持续改进

---

<div align="center">

**AI驱动的Markdown图片工作流专家** ✨

[⭐ Star](https://github.com/beiffeng/markdown-image-ai-workflow) | [🐛 报告问题](https://github.com/beiffeng/markdown-image-ai-workflow/issues) | [💬 讨论](https://github.com/beiffeng/markdown-image-ai-workflow/discussions)

</div>
