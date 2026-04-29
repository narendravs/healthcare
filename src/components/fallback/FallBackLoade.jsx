const FullScreenLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-black">
    <div className="flex flex-col items-center gap-2">
      {/* If you have a loader icon, you can add it here with animate-spin */}
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-blue-500 border-gray-600" />
      <p className="text-white text-lg font-semibold">Loading...</p>
    </div>
  </div>
);

export default FullScreenLoader;
