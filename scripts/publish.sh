#!/bin/bash

# VSCode插件一键发布脚本
# 使用方法: ./scripts/publish.sh [options] [version-type]
# 
# 选项:
#   --no-version, -n    跳过版本更新，直接发布当前版本
#   --help, -h          显示帮助信息
#
# 版本类型: patch|minor|major (默认: patch)

set -e  # 遇到错误立即退出

# 全局变量
SKIP_VERSION_UPDATE=false
SHOW_HELP=false

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

# 显示帮助信息
show_help() {
    echo "VSCode插件一键发布脚本"
    echo
    echo "使用方法:"
    echo "  ./scripts/publish.sh [options] [version-type]"
    echo
    echo "选项:"
    echo "  --no-version, -n    跳过版本更新，直接发布当前版本"
    echo "  --help, -h          显示此帮助信息"
    echo
    echo "版本类型:"
    echo "  patch               补丁版本 (默认)"
    echo "  minor               次版本"
    echo "  major               主版本"
    echo
    echo "示例:"
    echo "  ./scripts/publish.sh                    # 更新补丁版本并发布"
    echo "  ./scripts/publish.sh minor              # 更新次版本并发布"
    echo "  ./scripts/publish.sh --no-version       # 不更新版本，直接发布"
    echo "  ./scripts/publish.sh -n patch           # 不更新版本，直接发布"
}

# 解析命令行参数
parse_arguments() {
    local version_type="patch"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-version|-n)
                SKIP_VERSION_UPDATE=true
                shift
                ;;
            --help|-h)
                SHOW_HELP=true
                shift
                ;;
            patch|minor|major)
                version_type="$1"
                shift
                ;;
            *)
                log_error "未知参数: $1"
                echo
                show_help
                exit 1
                ;;
        esac
    done
    
    echo "$version_type"
}

# 检查当前版本状态
check_current_version() {
    local current_version=$(node -p "require('./package.json').version")
    local latest_tag=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "none")
    
    log_info "当前版本状态:"
    echo "  package.json: v$current_version"
    echo "  最新Git标签: v$latest_tag"
    
    if [ "$latest_tag" != "none" ] && [ "$current_version" = "$latest_tag" ]; then
        log_warning "当前版本 v$current_version 已经存在对应的Git标签"
        echo "  如果要重新发布相同版本，请确认这是期望的行为"
        echo
        read -p "继续发布当前版本? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "发布已取消"
            exit 0
        fi
    fi
    
    echo "$current_version"
}

# 主函数
main() {
    # 解析参数
    local version_type=$(parse_arguments "$@")
    
    # 显示帮助
    if [ "$SHOW_HELP" = true ]; then
        show_help
        exit 0
    fi
    
    log_info "开始VSCode插件发布流程..."
    echo
    
    # 执行发布步骤
    check_dependencies
    check_git_status
    run_compile_check
    check_required_files
    
    local new_version
    if [ "$SKIP_VERSION_UPDATE" = true ]; then
        log_info "跳过版本更新..."
        new_version=$(check_current_version)
    else
        new_version=$(update_version $version_type)
    fi
    
    package_test
    publish_to_marketplace
    
    # 只有在实际更新了版本时才推送Git更改
    if [ "$SKIP_VERSION_UPDATE" = false ]; then
        push_git_changes $new_version
    else
        log_info "跳过Git提交和标签创建（版本未更新）"
    fi
    
    post_publish_reminder $new_version
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi