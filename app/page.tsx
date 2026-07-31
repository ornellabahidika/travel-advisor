import { Advisor } from "./components/Advisor";
import { Header } from "./components/Header";

export default function Home() {
  return (
    <main className="min-h-screen bg-amber-50">
      <Header />
      <Advisor />
    </main>
  );
}
