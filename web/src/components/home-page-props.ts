import type { ReactNode } from "react";
import type { ContentPost } from "@/lib/content-schemas";
import type { ClassHomeSection } from "@/lib/student-home";

export type HomePageProps = {
  posts: ContentPost[];
  unavailable: boolean;
  accountName: string | null;
  section: ClassHomeSection;
  studentSignedIn: boolean;
  classroom: ReactNode;
};
