#!/bin/bash

# VSCode插件一键发布脚本
# 使用方法: ./scripts/publish.sh [patch|minor|major]

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖环境..."
    
    if ! command -v vsce &> /dev/null; then
        log_error "vsce未安装，请运行: npm install -g @vscode/vsce"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm未安装，请先安装Node.js"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 检查Git状态
check_git_status() {
    log_info "检查Git仓库状态..."
    
    if [ -n "$(git status --porcelain)" ]; then
        log_warning "存在未提交的更改："
        git status --short
        read -p "是否继续发布? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "发布已取消"
            exit 0
        fi
    fi
    
    log_success "Git状态检查通过"
}

# 运行编译检查
run_compile_check() {
    log_info "运行TypeScript编译检查..."
    
    if ! npm run compile; then
        log_error "编译失败，请修复错误后重试"
        exit 1
    fi
    
    log_success "编译检查通过"
}

# 检查关键文件
check_required_files() {
    log_info "检查必需文件..."
    
    local required_files=("package.json" "README.md" "LICENSE" "icons/icon.png")
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "缺少必需文件: $file"
            exit 1
        fi
    done
    
    # 检查图标尺寸（需要file命令支持）
    if command -v file &> /dev/null; then
        local icon_info=$(file icons/icon.png)
        if [[ ! $icon_info =~ "128 x 128" ]]; then
            log_warning "图标可能不是128x128尺寸，请检查"
        fi
    fi
    
    log_success "文件检查通过"
}

# 版本更新
update_version() {
    local version_type=${1:-"patch"}
    
    log_info "更新版本 ($version_type)..."
    
    local old_version=$(node -p "require('./package.json').version")
    
    if ! npm version $version_type --no-git-tag-version; then
        log_error "版本更新失败"
        exit 1
    fi
    
    local new_version=$(node -p "require('./package.json').version")
    log_success "版本已更新: $old_version -> $new_version"
    
    echo $new_version
}

# 本地打包测试
package_test() {
    log_info "进行本地打包测试..."
    
    if ! vsce package; then
        log_error "打包失败"
        exit 1
    fi
    
    local package_name=$(node -p "require('./package.json').name")
    local version=$(node -p "require('./package.json').version")
    local vsix_file="${package_name}-${version}.vsix"
    
    if [ -f "$vsix_file" ]; then
        local file_size=$(du -h "$vsix_file" | cut -f1)
        log_success "打包成功: $vsix_file ($file_size)"
        
        # 提示用户检查包内容
        log_info "如需检查包内容，运行: vsce ls"
    else
        log_error "未找到打包文件"
        exit 1
    fi
}

# 发布到市场
publish_to_marketplace() {
    log_info "准备发布到VSCode Marketplace..."
    
    # 检查是否已登录
    log_info "检查发布者登录状态..."
    
    read -p "请确认已通过 'vsce login beifeng' 登录，继续发布? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "发布已取消"
        exit 0
    fi
    
    log_info "发布插件到市场..."
    
    if ! vsce publish; then
        log_error "发布失败"
        exit 1
    fi
    
    log_success "插件发布成功！"
}

# 推送Git更改
push_git_changes() {
    local version=$1
    
    log_info "提交并推送更改到Git仓库..."
    
    # 添加更改的文件
    git add package.json
    
    # 创建提交
    git commit -m "🔖 发布版本 v${version}

📦 版本更新:
- 更新版本号至 ${version}
- 通过一键发布脚本自动发布

🚀 发布信息:
- 插件ID: beifeng.markdown-image-ai-workflow
- 市场地址: https://marketplace.visualstudio.com/items?itemName=beifeng.markdown-image-ai-workflow

🤖 Generated with publish script"
    
    # 创建版本标签
    git tag "v${version}"
    
    # 推送到远程
    git push origin main
    git push origin "v${version}"
    
    log_success "Git更改已推送，版本标签已创建"
}

# 发布后验证提醒
post_publish_reminder() {
    local version=$1
    
    log_success "🎉 发布完成！"
    echo
    echo "📋 请进行以下验证："
    echo "  1. 访问市场页面检查信息显示"
    echo "  2. 在VSCode中搜索插件名称"
    echo "  3. 测试从市场安装插件"
    echo "  4. 验证核心功能正常工作"
    echo
    echo "🔗 有用链接："
    echo "  • 市场页面: https://marketplace.visualstudio.com/items?itemName=beifeng.markdown-image-ai-workflow"
    echo "  • 管理页面: https://marketplace.visualstudio.com/manage/publishers/beifeng"
    echo "  • GitHub仓库: https://github.com/beiffeng/markdown-image-ai-workflow"
    echo
    log_info "发布流程完成 ✨"
}

# 主函数
main() {
    local version_type=${1:-"patch"}
    
    # 验证版本类型参数
    if [[ ! "$version_type" =~ ^(patch|minor|major)$ ]]; then
        log_error "无效的版本类型: $version_type"
        echo "使用方法: ./scripts/publish.sh [patch|minor|major]"
        exit 1
    fi
    
    log_info "开始VSCode插件发布流程..."
    echo
    
    # 执行发布步骤
    check_dependencies
    check_git_status
    run_compile_check
    check_required_files
    
    local new_version=$(update_version $version_type)
    
    package_test
    publish_to_marketplace
    push_git_changes $new_version
    post_publish_reminder $new_version
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi