import clsx from "clsx";
import Image from "next/image";

import { StatusIcon } from "../constants/index";
import { Status } from "../types/appwrite.types";

export const StatusBadge = ({ status }: { status: Status }) => {
  return (
    <div
      className={clsx(
        "status-badge flex justify-center items-center gap-5 p-2",
        {
          "bg-green-600": status === "scheduled",
          "bg-blue-600": status === "pending",
          "bg-red-600": status === "cancelled",
        }
      )}
    >
      <Image
        src={StatusIcon[status]}
        alt="doctor"
        width={24}
        height={24}
        className="h-fit w-3 "
      />
      <p
        className={clsx("text-12-semibold capitalize ", {
          "text-green-500": status === "scheduled",
          "text-blue-500": status === "pending",
          "text-red-500": status === "cancelled",
        })}
      >
        {status}
      </p>
    </div>
  );
};
