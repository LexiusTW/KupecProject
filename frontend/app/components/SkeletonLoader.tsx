'use client';

interface SkeletonLoaderProps {
  className?: string;
}

export default function SkeletonLoader({ className }: SkeletonLoaderProps) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-md ${className || ''}`}>
    </div>
  );
}