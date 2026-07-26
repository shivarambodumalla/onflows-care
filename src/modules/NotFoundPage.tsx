import { useNavigate } from 'react-router'
import { Compass } from 'lucide-react'
import { Button, StateView } from '@/design-system'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <StateView
      kind="error"
      size="page"
      icon={Compass}
      title="That page does not exist"
      description="The link may be out of date, or the record it pointed at has been removed."
      action={
        <>
          <Button variant="primary" onClick={() => navigate('/')}>
            Go to dashboard
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </>
      }
    />
  )
}
