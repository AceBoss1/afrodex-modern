// app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to default trading pair (AfroX-ETH)
  redirect('/trade/AfroX-ETH');
}
