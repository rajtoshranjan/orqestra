import "./assets/styles.css";
import { Flow } from "./flow";
import { Header } from "./header";

function App() {
  return (
    <div>
      <Header />
      <div className="w-full">
        <Flow className="h-[100dvh]" />
      </div>
    </div>
  );
}

export default App;
