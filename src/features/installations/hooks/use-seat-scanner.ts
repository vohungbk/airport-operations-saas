"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { verifySeatScanAction } from "@/features/installations/actions/verify-seat-scan.action";
import type { VerifySeatScanResult } from "@/features/installations/lib/seat-scan-result";
import { runJobAction } from "@/features/jobs/lib/run-job-action";

/** The part of the browser's `BarcodeDetector` this hook uses (it is not in every TypeScript `lib`). */
interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

/** `unavailable`: the camera was denied, there is none, or the browser cannot read a QR code (spec R9). */
export type CameraState = "starting" | "ready" | "unavailable";

const SCAN_INTERVAL_MS = 300;

/** `torch` is not in every TypeScript `lib`; only some phones have it. */
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

/**
 * UI-F07-S02 (spec R2, R9): the camera, the torch and the check of a code. A read code (or a typed one) is
 * sent to `verifySeatScanAction`, which only reads: a scan grants nothing (R8). The camera runs while no
 * result is shown, and stops when it is, and when the screen is left. With no camera the technician types
 * the code and the steps go on.
 */
export function useSeatScanner(jobId: string) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [typing, setTyping] = useState(false);
  const [result, setResult] = useState<VerifySeatScanResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = useCallback(
    (code: string) => {
      setResult(null);
      startTransition(async () => {
        setResult(await runJobAction(() => verifySeatScanAction({ job_id: jobId, code })));
      });
    },
    [jobId],
  );

  const scanning = !(result?.success) && !isPending;

  useEffect(() => {
    if (!scanning) return;

    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stream: MediaStream | undefined;

    // A phone with no camera, or a browser that cannot read a QR code, takes the same way out as a denied
    // camera: the technician types the code (spec R9).
    const opening =
      Detector && navigator.mediaDevices?.getUserMedia
        ? navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        : Promise.reject(new Error("no camera"));

    opening
      .then(async (opened) => {
        const detector = new Detector!({ formats: ["qr_code"] });
        if (stopped) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
        const track = opened.getVideoTracks()[0];
        trackRef.current = track ?? null;
        setTorchSupported(Boolean((track?.getCapabilities?.() as TorchCapabilities | undefined)?.torch));
        const video = videoRef.current;
        if (video) {
          video.srcObject = opened;
          await video.play().catch(() => undefined);
        }
        setCamera("ready");

        timer = setInterval(async () => {
          if (!video || video.readyState < 2) return;
          const [found] = await detector.detect(video).catch(() => []);
          if (found?.rawValue && !stopped) {
            stopped = true;
            clearInterval(timer);
            submit(found.rawValue);
          }
        }, SCAN_INTERVAL_MS);
      })
      .catch(() => {
        if (stopped) return;
        setCamera("unavailable");
        setTyping(true);
      });

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      trackRef.current = null;
      setTorchOn(false);
    };
  }, [scanning, submit]);

  const toggleTorch = useCallback(async () => {
    const next = !torchOn;
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  const scanAgain = useCallback(() => {
    setResult(null);
    setTyping(false);
  }, []);

  return {
    videoRef,
    camera,
    torchSupported,
    torchOn,
    toggleTorch,
    typing,
    setTyping,
    submit,
    result,
    isPending,
    scanAgain,
  };
}
