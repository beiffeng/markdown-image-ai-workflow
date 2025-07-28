#!/bin/bash

# VSCode插件版本管理脚本
# 使用方法: ./scripts/version.sh [command] [version-type]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 显示使用帮助
show_usage() {
    echo "VSCode插件版本管理脚本"
    echo
    echo "使用方法:"
    echo "  ./scripts/version.sh <command> [options]"
    echo
    echo "命令:"
    echo "  current                   显示当前版本"
    echo "  bump <type>              更新版本号"
    echo "  check                    检查版本一致性"
    echo "  changelog                生成更新日志"
    echo "  help                     显示此帮助信息"
    echo
    echo "版本类型 (用于bump命令):"
    echo "  patch                    补丁版本 (1.0.0 -> 1.0.1)"
    echo "  minor                    次版本 (1.0.0 -> 1.1.0)"
    echo "  major                    主版本 (1.0.0 -> 2.0.0)"
    echo
    echo "示例:"
    echo "  ./scripts/version.sh current"
    echo "  ./scripts/version.sh bump patch"
    echo "  ./scripts/version.sh check"
}

# 获取当前版本
get_current_version() {
    if [ ! -f "package.json" ]; then
        log_error "未找到package.json文件"
        exit 1
    fi
    
    node -p "require('./package.json').version" 2>/dev/null || {
        log_error "无法从package.json读取版本信息"
        exit 1
    }
}

# 显示当前版本信息
show_current_version() {
    local version=$(get_current_version)
    local name=$(node -p "require('./package.json').name")
    local display_name=$(node -p "require('./package.json').displayName")
    
    echo "📦 插件信息:"
    echo "  名称: $name"
    echo "  显示名: $display_name"
    echo "  当前版本: v$version"
    echo
    
    # 检查是否有Git标签
    if git tag -l "v$version" | grep -q "v$version"; then
        log_success "版本标签 v$version 已存在"
    else
        log_warning "版本标签 v$version 不存在"
    fi
    
    # 显示最近的提交
    log_info "最近的提交:"
    git log --oneline -3
}

# 版本号验证
validate_version_type() {
    local type=$1
    case $type in
        patch|minor|major)
            return 0
            ;;
        *)
            log_error "无效的版本类型: $type"
            echo "支持的类型: patch, minor, major"
            exit 1
            ;;
    esac
}

# 计算新版本号
calculate_new_version() {
    local current=$1
    local type=$2
    
    # 分解版本号
    IFS='.' read -ra VERSION_PARTS <<< "$current"
    local major=${VERSION_PARTS[0]}
    local minor=${VERSION_PARTS[1]}
    local patch=${VERSION_PARTS[2]}
    
    case $type in
        patch)
            patch=$((patch + 1))
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
    esac
    
    echo "$major.$minor.$patch"
}

# 更新版本号
bump_version() {
    local type=$1
    
    validate_version_type $type
    
    local current_version=$(get_current_version)
    local new_version=$(calculate_new_version $current_version $type)
    
    log_info "准备更新版本: v$current_version -> v$new_version"
    
    # 检查Git状态
    if [ -n "$(git status --porcelain)" ]; then
        log_warning "存在未提交的更改，建议先提交"
        git status --short
        echo
        read -p "是否继续更新版本? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "操作已取消"
            exit 0
        fi
    fi
    
    # 更新package.json
    log_info "更新package.json..."
    npm version $new_version --no-git-tag-version
    
    log_success "版本已更新至 v$new_version"
    
    # 询问是否创建Git提交和标签
    echo
    read -p "是否创建Git提交和版本标签? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_version_commit $current_version $new_version $type
    fi
}

# 创建版本提交和标签
create_version_commit() {
    local old_version=$1
    local new_version=$2
    local type=$3
    
    log_info "创建版本提交..."
    
    # 生成提交信息
    local commit_msg="🔖 更新版本至 v${new_version}

📦 版本更新:
- 版本类型: $type
- 旧版本: v$old_version
- 新版本: v$new_version

🤖 Generated with version script"
    
    # 提交更改
    git add package.json
    git commit -m "$commit_msg"
    
    # 创建标签
    git tag "v$new_version" -m "Release v$new_version"
    
    log_success "已创建提交和标签 v$new_version"
    
    # 询问是否推送
    echo
    read -p "是否推送到远程仓库? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push origin main
        git push origin "v$new_version"
        log_success "已推送到远程仓库"
    fi
}

# 检查版本一致性
check_version_consistency() {
    log_info "检查版本一致性..."
    
    local package_version=$(get_current_version)
    local latest_tag=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "none")
    
    echo "📊 版本检查:"
    echo "  package.json: v$package_version"
    echo "  最新Git标签: v$latest_tag"
    
    if [ "$latest_tag" = "none" ]; then
        log_warning "没有找到Git版本标签"
    elif [ "$package_version" = "$latest_tag" ]; then
        log_success "版本一致"
    else
        log_warning "版本不一致，可能需要创建新标签或更新版本"
    fi
    
    # 检查未发布的提交
    if [ "$latest_tag" != "none" ]; then
        local commits_since_tag=$(git rev-list "v$latest_tag"..HEAD --count)
        if [ "$commits_since_tag" -gt 0 ]; then
            log_info "自上次标签后有 $commits_since_tag 个新提交"
            echo "最近的提交:"
            git log "v$latest_tag"..HEAD --oneline | head -5
        else
            log_info "没有新提交"
        fi
    fi
}

# 生成更新日志
generate_changelog() {
    log_info "生成更新日志..."
    
    local latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    local changelog_file="CHANGELOG.md"
    
    if [ -z "$latest_tag" ]; then
        log_warning "没有找到版本标签，显示所有提交历史"
        echo "# 更新日志" > $changelog_file
        echo "" >> $changelog_file
        echo "## [Unreleased]" >> $changelog_file
        git log --pretty=format:"- %s (%h)" >> $changelog_file
    else
        local current_version=$(get_current_version)
        echo "# 更新日志" > $changelog_file
        echo "" >> $changelog_file
        echo "## [Unreleased]" >> $changelog_file
        git log "${latest_tag}"..HEAD --pretty=format:"- %s (%h)" >> $changelog_file
        echo "" >> $changelog_file
        echo "" >> $changelog_file
        echo "## [$latest_tag] - $(git log -1 --format=%cd --date=short $latest_tag)" >> $changelog_file
        git log --pretty=format:"- %s (%h)" $latest_tag >> $changelog_file
    fi
    
    log_success "更新日志已生成: $changelog_file"
}

# 主函数
main() {
    local command=${1:-"help"}
    
    case $command in
        current)
            show_current_version
            ;;
        bump)
            local version_type=${2:-"patch"}
            bump_version $version_type
            ;;
        check)
            check_version_consistency
            ;;
        changelog)
            generate_changelog
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "未知命令: $command"
            echo
            show_usage
            exit 1
            ;;
    esac
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi