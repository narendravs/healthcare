import React from "react";
import clsx from "clsx";
import Image from "next/image";

type StatCardProps = {
  type: "appointments" | "pending" | "cancelled";
  count: number;
  label: string;
  icon: string;
};
const StatCard = ({ label, count, type, icon }: StatCardProps) => {
  return (
    <div
      className={clsx("stat-card", {
        "bg-appointments": type === "appointments",
        "bg-pending": type === "pending",
        "bg-cancelled": type === "cancelled",
      })}
    >
      <div className="flex align-items-center gap-4">
        <Image
          src={icon}
          alt={label}
          width={24}
          height={24}
          className="size-8 gap-4"
        />
        <h2 className="text-32-bold text-black">{count}</h2>
      </div>
      <p className="text-14-regular">{label}</p>
    </div>
  );
};

export default StatCard;
