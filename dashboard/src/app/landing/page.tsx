import type { Metadata } from 'next';
import LandingClient from './LandingClient';

export const metadata: Metadata = {
  title: 'VersionGate Engine — Zero-Downtime Deployments',
  description: 'Self-hosted blue-green deployment engine. Push to GitHub, VersionGate handles the rest. No cloud lock-in.',
};

export default function LandingPage() {
  return <LandingClient />;
}
