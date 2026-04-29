import { Suspense } from "react";

import HomeContent from "@/components/home/HomeContent";
import FullScreenLoader from "@/components/fallback/FallBackLoade";

export const dynamic = "force-dynamic";
const Home = () => {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <HomeContent />
    </Suspense>
  );
};

export default Home;
