import { StudioBar } from '@/components/StudioBar';
import { Workspace } from '@/components/Workspace';
import { EnvBanner } from '@/components/EnvBanner';

export default function Page() {
  return (
    <>
      <EnvBanner />
      <StudioBar />
      <Workspace />
    </>
  );
}
