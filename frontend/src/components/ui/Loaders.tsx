export function Shimmer() {
  return <div className="shimmer" />
}
export function ErrorToast({ msg }: { msg: string }) {
  return <div className="toast error">{msg}</div>
}