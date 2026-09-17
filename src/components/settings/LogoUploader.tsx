"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import NextImage from "next/image";
import { Upload, X, Link as LinkIcon, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogoUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  businessType?: string;
  businessName?: string;
}

export function LogoUploader({
  value = "",
  onChange,
  businessType = "restaurant",
  businessName = "",
}: LogoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState(value);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resize and optimize image to ensure it fits well in jsonb config
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona un archivo de imagen válido (PNG, JPG, SVG, WebP).");
      return;
    }

    // For SVGs, read directly as data URL to preserve vector quality
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        onChange(result);
        setCustomUrl(result);
      };
      reader.readAsDataURL(file);
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Export as optimized webp (or png if webp not supported)
          const dataUrl = canvas.toDataURL("image/webp", 0.9) || canvas.toDataURL("image/png");
          onChange(dataUrl);
          setCustomUrl(dataUrl);
        }
        setIsProcessing(false);
      };
      img.onerror = () => {
        setIsProcessing(false);
        alert("No se pudo procesar la imagen seleccionada.");
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClear = () => {
    onChange("");
    setCustomUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleApplyUrl = () => {
    if (customUrl.trim()) {
      onChange(customUrl.trim());
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-[11px] font-black tracking-[0.1em] text-slate-700 uppercase dark:text-slate-300">
            Logo del Negocio / Marca
          </Label>
          <p className="text-[11px] font-medium text-slate-400">
            Personaliza el logo que aparecerá en el Sidebar, Navbar y cabecera del cliente.
          </p>
        </div>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-8 text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          >
            <X className="mr-1.5 h-3.5 w-3.5" /> Quitar Logo
          </Button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Upload Dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "group relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition-all",
            isDragging
              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
              : "border-slate-200 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/20 dark:border-slate-800 dark:bg-slate-900/50"
          )}
        >
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:scale-110 dark:bg-blue-950/50 dark:text-blue-400">
            <Upload className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {isProcessing ? "Procesando imagen..." : "Haz clic para subir o arrastra tu logo"}
          </span>
          <span className="mt-1 text-[10px] font-medium text-slate-400">
            PNG, JPG, SVG o WebP (Recomendado fondo transparente)
          </span>
        </div>

        {/* Live Preview Container */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">
              Previsualización en Sidebar
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black tracking-widest text-slate-500 uppercase dark:bg-slate-800 dark:text-slate-400">
              {businessType === "restaurant" ? "🍽️ Restaurante" : "💼 Negocio"}
            </span>
          </div>

          <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-100 bg-gradient-to-r from-slate-900 to-slate-950 p-4 dark:border-slate-800">
            {value ? (
              <div className="relative flex max-h-16 w-full items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value}
                  alt={businessName || "Logo del cliente"}
                  className="max-h-12 w-auto max-w-[200px] object-contain drop-shadow-md"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <NextImage
                  src="/logo-login.png"
                  alt="Default Logo"
                  width={140}
                  height={40}
                  className="max-h-8 w-auto opacity-40 grayscale"
                />
                <span className="text-[10px] font-semibold text-slate-500">(Por defecto)</span>
              </div>
            )}
          </div>

          {/* Quick link button to paste URL */}
          <div className="mt-3 flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400"
            >
              <LinkIcon className="h-3 w-3" />
              {showUrlInput ? "Ocultar URL directa" : "Usar URL de imagen externa"}
            </button>
            {value && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" /> Logo activo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* External URL Input Drawer */}
      {showUrlInput && (
        <div className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50/40 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
          <Input
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://mi-dominio.com/logo.png"
            className="h-10 text-xs font-medium"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleApplyUrl}
            className="h-10 bg-blue-600 px-4 font-bold text-white hover:bg-blue-700"
          >
            Aplicar URL
          </Button>
        </div>
      )}
    </div>
  );
}
