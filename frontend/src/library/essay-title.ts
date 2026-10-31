/**
 * 「分数之外：一个学渣的……」这种长题目：冒号前面是主标题，后面是副题，分开排才不会在半个词上折行。
 * 没有冒号就整个当主标题。
 */
export function splitTitle(title: string): { main: string; sub: string | null } {
  const at = title.search(/[：:]/)
  return at > 0 ? { main: title.slice(0, at), sub: title.slice(at + 1).trim() || null } : { main: title, sub: null }
}
