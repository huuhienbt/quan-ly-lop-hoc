import { redirect } from "next/navigation";
import { classHomeLinks } from "@/lib/student-home";

export default function ProverbQuizPage() {
  redirect(classHomeLinks["do-vui"]);
}
