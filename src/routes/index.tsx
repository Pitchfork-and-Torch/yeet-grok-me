import { createFileRoute } from "@tanstack/react-router";
import { YeetGame } from "@/components/yeet/YeetGame";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <YeetGame />;
}
