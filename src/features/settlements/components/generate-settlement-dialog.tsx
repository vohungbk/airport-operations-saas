"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GenerateSettlementForm } from "@/features/settlements/components/generate-settlement-form";
import type { SettlementPartnerOption } from "@/features/settlements/lib/get-settlement-partners";

interface GenerateSettlementDialogProps {
  partners: SettlementPartnerOption[];
}

/** "Generate settlement" of the list header: the form of a partner and a month in a dialog, closed once the draft is created. */
export function GenerateSettlementDialog({ partners }: GenerateSettlementDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="min-h-11 px-4" />}>Generate settlement</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate settlement</DialogTitle>
          <DialogDescription>Choose a partner and a month to create a draft settlement.</DialogDescription>
        </DialogHeader>
        <GenerateSettlementForm
          partners={partners}
          onGenerated={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
