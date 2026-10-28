import { Component } from 'react'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** 一变就清掉错误。包在路由外面时传当前路径：点导航去别的页就恢复了 */
  resetKey?: string
}

/**
 * 渲染出错时的兜底。没有它，任何一个组件抛异常整页都会白屏，连导航都没了。
 *
 * 发版后开着的旧页面再去加载分包（比如 self），那个文件已经被 rsync --delete 删了，
 * 也会落到这里 —— 所以给的出路是刷新，刷新会拿到新的 index.html。
 * 错误本身 React 会打到控制台，这里不再打一遍。
 */
type State = { failed: boolean; resetKey?: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  // resetKey 变了就清掉错误。在渲染前就定下来，不用等 componentDidUpdate 再多渲染一遍
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="py-24 text-center font-ui text-sumi">
        <p className="font-mincho text-2xl">这一页出错了</p>
        <p className="mt-3 text-sm text-hai">刷新一下通常就好</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 text-sm text-ai hover:underline"
        >
          刷新
        </button>
      </div>
    )
  }
}
