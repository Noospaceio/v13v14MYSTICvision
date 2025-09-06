import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
const Noospace = dynamic(() => import('../components/Noospace'), { ssr: false })

export default function AppPage() {
  const router = useRouter();
  const mode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('mode') : null;
  const guestMode = mode === 'guest';

  return <Noospace guestMode={guestMode} />
}
