import { ProjectDetailClient } from "@/components/ProjectDetailClient";

// generateStaticParams must live in a Server Component.
// The actual project ID is resolved client-side at runtime via useParams().
export function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default function ProjectDetailPage() {
  return <ProjectDetailClient />;
}
