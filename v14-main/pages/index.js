import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

const Noospace = dynamic(() => import('../components/Noospace'), { ssr: false });

export default function Home() {
  const router = useRouter();
  const mode = router.query.mode;

  return <Noospace guestMode={mode === 'guest'} />;
}
