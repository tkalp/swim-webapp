export const Copyright = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="mt-6 text-center">
      <p className="text-xs text-slate-500">
        © {currentYear}{' '}
        <span className="font-semibold bg-linear-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
          Lablytics
        </span>
        . All rights reserved.
      </p>
    </div>
  );
};
