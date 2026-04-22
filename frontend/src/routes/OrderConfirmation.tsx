import { useParams } from 'react-router-dom'

export default function OrderConfirmation() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="page-stub">
      <h1 className="h1">You're all set, traveler.</h1>
      <p className="lede" style={{ marginTop: 16 }}>
        Order <span className="num">{id}</span> — QR install flow with
        iPhone / Android / Manual tabs ships in M3.
      </p>
    </div>
  )
}
