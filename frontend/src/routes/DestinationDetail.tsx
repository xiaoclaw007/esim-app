import { useParams } from 'react-router-dom'

export default function DestinationDetail() {
  const { country } = useParams<{ country: string }>()
  return (
    <div className="page-stub">
      <span className="eyebrow">HOME / DESTINATIONS / {country?.toUpperCase()}</span>
      <h1 className="display" style={{ marginTop: 16 }}>
        {country?.toUpperCase()} eSIM
      </h1>
      <p className="lede" style={{ marginTop: 16 }}>
        Plan matrix (Regular / Unlimited tabs) + coverage ships in M2.
      </p>
    </div>
  )
}
