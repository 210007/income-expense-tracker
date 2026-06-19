"use client";

export default function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center align-middle ml-1">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-bold border border-current opacity-30 group-hover:opacity-60 cursor-help transition-opacity select-none">
        i
      </span>
      <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block w-56 text-xs bg-gray-900 text-white rounded-lg px-3 py-2 z-[100] shadow-xl leading-relaxed whitespace-normal">
        {text}
        <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
      </span>
    </span>
  );
}
