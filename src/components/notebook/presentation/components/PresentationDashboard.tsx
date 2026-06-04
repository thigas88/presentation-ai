"use client";

import {
  fetchPresentations,
  type PresentationDocumentTypeFilter,
} from "@/app/_actions/notebook/presentation/fetchPresentations";
import { createEmptyPresentation } from "@/app/_actions/notebook/presentation/presentationActions";
import { ModelPicker } from "@/components/notebook/presentation/components/ModelPicker";
import { OutlineTemplateModal } from "@/components/notebook/presentation/components/outline/OutlineTemplateModal";
import { useBlankPresentationCreator } from "@/hooks/presentation/useBlankPresentationCreator";
import {
  getPresentationGenerationAspectRatioLabel,
  type PresentationGenerationAspectRatio,
} from "@/lib/presentation/aspect-ratio";
import { buildPresentationCustomization } from "@/lib/presentation/customization";
import { cn } from "@/lib/utils";
import { usePresentationState } from "@/states/presentation-state";
import { useInfiniteQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  ArrowRight,
  Check,
  Clock3,
  Folder,
  Globe,
  Grid2X2,
  Languages,
  LayoutGrid,
  LayoutTemplate,
  List,
  Loader2,
  PanelsTopLeft,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRESENTATIONS_QUERY_KEY = ["presentations"] as const;
const ALL_PRESENTATION_DOCUMENT_TYPES = "ALL";
type PresentationDocumentTypeFilterValue =
  | typeof ALL_PRESENTATION_DOCUMENT_TYPES
  | PresentationDocumentTypeFilter;

type PresentationFileItem = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  modified: string;
  modifiedAt: Date;
  isFavorited: boolean;
  onClick: () => void;
};

type LibraryTab = "all" | "recent" | "favorites";
type ViewMode = "grid" | "list";
type SortBy = "date-desc" | "date-asc" | "name-asc" | "name-desc";

const LANGUAGE_OPTIONS = [
  { label: "English", value: "en-US" },
  { label: "Portuguese", value: "pt" },
  { label: "Spanish", value: "es" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Italian", value: "it" },
  { label: "Japanese", value: "ja" },
  { label: "Korean", value: "ko" },
  { label: "Chinese", value: "zh" },
  { label: "Russian", value: "ru" },
  { label: "Hindi", value: "hi" },
  { label: "Arabic", value: "ar" },
] as const;

const SLIDE_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  label: `${index + 1} slide${index === 0 ? "" : "s"}`,
  value: String(index + 1),
}));

function getPresentationRoute(item: {
  hasContent: boolean;
  hasSlides: boolean;
  id: string;
}) {
  return item.hasSlides || item.hasContent
    ? `/presentation/${item.id}`
    : `/presentation/generate/${item.id}`;
}

function NotebookPageLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="notebook-section relative h-full w-full max-w-[100vw] min-w-0 overflow-x-hidden overflow-y-auto"
      style={{ scrollbarGutter: "stable" }}
    >
      <main className="mx-auto mt-4 w-full max-w-[min(100vw,72rem)] min-w-0 px-3 pb-8 sm:mt-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

function GreetingSection() {
  return (
    <section className="mb-5 flex flex-col items-center text-center sm:mb-6">
      <h1 className="max-w-4xl text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
        What presentation would you like to create today?
      </h1>
    </section>
  );
}

function SettingPill({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent sm:h-9 sm:px-3.5 sm:text-sm"
        >
          <Icon className="size-3.5 shrink-0 sm:size-4" />
          <span className="truncate">{label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 max-w-[calc(100vw-1rem)] p-2"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotebookInputBox({
  placeholder,
  value,
  onChange,
  onSubmit,
  submitDisabled,
  isSubmitting,
  children,
  topRightContent,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  isSubmitting: boolean;
  children: ReactNode;
  topRightContent?: ReactNode;
}) {
  return (
    <div className="relative mb-4 min-w-0 rounded-xl border border-border bg-background p-2.5 shadow sm:p-4">
      {topRightContent ? (
        <div className="absolute top-2.5 right-2.5 z-10 sm:top-4 sm:right-4">
          {topRightContent}
        </div>
      ) : null}
      <textarea
        aria-label="Presentation prompt"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.ctrlKey && !submitDisabled) {
            event.preventDefault();
            onSubmit();
          }
        }}
        className={cn(
          "mb-3 h-24 w-full min-w-0 resize-none bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none sm:h-30",
          topRightContent ? "pr-34 sm:pr-44" : undefined,
        )}
      />
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          aria-busy={isSubmitting}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground transition-colors sm:h-9 sm:w-9",
            isSubmitting
              ? "cursor-wait opacity-100"
              : "hover:bg-foreground/90 disabled:opacity-50",
          )}
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin text-background" />
          ) : (
            <ArrowRight className="size-4 text-background" />
          )}
        </button>
      </div>
    </div>
  );
}

function PresentationProjectFilesSection({
  files,
  isLoading,
  onCreateNew,
  filterOptions,
  activeFilterId,
  onFilterChange,
}: {
  files: PresentationFileItem[];
  isLoading?: boolean;
  onCreateNew: () => void;
  filterOptions: { id: string; label: string }[];
  activeFilterId: string;
  onFilterChange: (filterId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<LibraryTab>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("date-desc");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: LibraryTab; label: string; icon: LucideIcon }[] = [
    { id: "all", label: "All", icon: Archive },
    { id: "recent", label: "Recently viewed", icon: Clock3 },
    { id: "favorites", label: "Favorites", icon: Star },
  ];
  const sortOptions: { id: SortBy; label: string; icon: LucideIcon }[] = [
    { id: "date-desc", label: "Newest first", icon: Clock3 },
    { id: "date-asc", label: "Oldest first", icon: Clock3 },
    { id: "name-asc", label: "Name A-Z", icon: Grid2X2 },
    { id: "name-desc", label: "Name Z-A", icon: Grid2X2 },
  ];
  const shouldShowSearchInput = Boolean(searchQuery) || isSearchOpen;
  const activeFiltersCount =
    (showFavoritesOnly ? 1 : 0) +
    (activeFilterId !== filterOptions[0]?.id ? 1 : 0);

  useEffect(() => {
    if (!shouldShowSearchInput) return;

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [shouldShowSearchInput]);

  const visibleFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let nextFiles = files.filter((file) => {
      if (activeTab === "favorites" || showFavoritesOnly) {
        if (!file.isFavorited) return false;
      }
      return query ? file.name.toLowerCase().includes(query) : true;
    });

    nextFiles = [...nextFiles].sort((a, b) => {
      if (sortBy === "date-desc") {
        return b.modifiedAt.getTime() - a.modifiedAt.getTime();
      }
      if (sortBy === "date-asc") {
        return a.modifiedAt.getTime() - b.modifiedAt.getTime();
      }
      if (sortBy === "name-desc") {
        return b.name.localeCompare(a.name);
      }
      return a.name.localeCompare(b.name);
    });

    return nextFiles;
  }, [activeTab, files, searchQuery, showFavoritesOnly, sortBy]);

  return (
    <div className="max-w-full min-w-0 overflow-x-hidden">
      <div className="mb-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 flex-1">
            <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:justify-end">
              <div className="order-2 shrink-0 sm:order-1">
                <div
                  className={cn(
                    "relative h-8.5 shrink-0 overflow-hidden transition-[width] duration-300 ease-out",
                    shouldShowSearchInput ? "w-36 sm:w-56 lg:w-64" : "w-8.5",
                  )}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSearchOpen(true)}
                    className={cn(
                      "absolute inset-0 size-8.5 p-0 transition-all duration-200 ease-out",
                      shouldShowSearchInput &&
                        "pointer-events-none scale-95 opacity-0",
                    )}
                  >
                    <Search className="size-4" />
                    <span className="sr-only">Search files</span>
                  </Button>
                  <div
                    className={cn(
                      "absolute inset-0 transition-all duration-300 ease-out",
                      shouldShowSearchInput
                        ? "translate-x-0 opacity-100"
                        : "pointer-events-none translate-x-2 opacity-0",
                    )}
                  >
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      aria-label="Search files"
                      placeholder="Search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="h-8.5 w-full min-w-0 rounded-lg border border-border bg-background py-1.5 pr-8 pl-9 text-sm text-foreground outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      aria-label="Close search"
                      onClick={() => {
                        setSearchQuery("");
                        setIsSearchOpen(false);
                      }}
                      className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="order-1 flex min-w-0 flex-row-reverse items-center gap-2 sm:order-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCreateNew}
                  className="h-8.5 gap-1.5 rounded-lg px-3"
                >
                  <Plus className="size-4" />
                  <span>Create new</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="relative size-8.5 p-0"
                    >
                      <SlidersHorizontal className="size-4" />
                      <span className="sr-only">Sort and filter files</span>
                      {activeFiltersCount > 0 ? (
                        <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground sm:static sm:h-5 sm:min-w-5 sm:rounded-full">
                          {activeFiltersCount}
                        </span>
                      ) : null}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    {sortOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.id}
                        onClick={() => setSortBy(option.id)}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <option.icon className="size-4" />
                          {option.label}
                        </span>
                        {sortBy === option.id ? (
                          <Check className="size-4" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Filter</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() =>
                        setShowFavoritesOnly((previous) => !previous)
                      }
                      className="flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Star
                          className={cn(
                            "size-4",
                            showFavoritesOnly &&
                              "fill-yellow-400 text-yellow-400",
                          )}
                        />
                        Favorites only
                      </span>
                      {showFavoritesOnly ? <Check className="size-4" /> : null}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Type</DropdownMenuLabel>
                    {filterOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.id}
                        onClick={() => onFilterChange(option.id)}
                        className="flex items-center justify-between"
                      >
                        <span>{option.label}</span>
                        {activeFilterId === option.id ? (
                          <Check className="size-4" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      viewMode === "grid"
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Grid2X2 className="size-3.5" />
                    <span className="hidden sm:inline">Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      viewMode === "list"
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <List className="size-3.5" />
                    <span className="hidden sm:inline">List</span>
                  </button>
                </div>
              </div>
            </div>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-background">
          {isLoading ? (
            viewMode === "grid" ? (
              <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`grid-skeleton-${index}`}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <div className="size-10 animate-pulse rounded-lg bg-muted" />
                      <div className="size-8 animate-pulse rounded-md bg-muted" />
                    </div>
                    <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="mb-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="h-6 w-24 animate-pulse rounded-md bg-muted" />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`list-skeleton-${index}`}
                    className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="size-9 animate-pulse rounded-lg bg-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                    <div className="size-8 animate-pulse rounded-md bg-muted" />
                  </div>
                ))}
              </div>
            )
          ) : visibleFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <Folder className="size-8 text-muted-foreground" />
              </div>
              <p className="mb-2 text-sm font-medium text-foreground">
                No presentations yet
              </p>
              <p className="mb-6 text-sm text-muted-foreground">
                Create your first presentation to get started
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 lg:grid-cols-3 xl:grid-cols-4">
              {visibleFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all duration-200 hover:border-primary/50 hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                >
                  <button
                    type="button"
                    aria-label={`Open ${file.name}`}
                    onClick={file.onClick}
                    className="absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:outline-none"
                  />
                  <div className="pointer-events-none relative z-20 aspect-video w-full overflow-hidden bg-muted/30">
                    {file.thumbnailUrl ? (
                      <Image
                        unoptimized
                        width={400}
                        height={300}
                        src={file.thumbnailUrl}
                        alt={file.name}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-accent/10">
                        <Folder className="size-12 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  {file.isFavorited ? (
                    <Star className="pointer-events-none absolute top-2 right-2 z-20 size-4 fill-yellow-400 text-yellow-400" />
                  ) : null}
                  <div className="pointer-events-none relative z-20 flex flex-1 flex-col p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4
                          className="truncate font-medium text-card-foreground"
                          title={file.name}
                        >
                          {file.name}
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {file.modified}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visibleFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative flex min-w-0 items-center gap-3 px-4 py-3 hover:bg-accent/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 sm:gap-4 sm:py-2.5"
                >
                  <button
                    type="button"
                    aria-label={`Open ${file.name}`}
                    onClick={file.onClick}
                    className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none"
                  />
                  <div className="pointer-events-none relative z-20 flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                    {file.thumbnailUrl ? (
                      <Image
                        unoptimized
                        width={400}
                        height={300}
                        src={file.thumbnailUrl}
                        alt={file.name}
                        className="h-12 w-20 shrink-0 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md border border-border bg-primary/10 text-primary">
                        <Folder className="size-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start gap-2">
                        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                          {file.name}
                        </p>
                        {file.isFavorited ? (
                          <Star className="mt-0.5 size-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
                        ) : null}
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{file.modified}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

export function PresentationDashboard() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [documentTypeFilter, setDocumentTypeFilter] =
    useState<PresentationDocumentTypeFilterValue>(
      ALL_PRESENTATION_DOCUMENT_TYPES,
    );
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const { createBlank: handleCreateBlank, isCreating: isCreatingBlank } =
    useBlankPresentationCreator();
  const {
    presentationInput,
    setPresentationInput,
    isGeneratingOutline,
    language,
    setLanguage,
    numSlides,
    setNumSlides,
    generationAspectRatio,
    setGenerationAspectRatio,
    webSearchEnabled,
    setWebSearchEnabled,
    autoThemeEnabled,
    setAutoThemeEnabled,
    setOutputFormat,
    setCurrentPresentation,
    setIsGeneratingOutline,
    setTheme,
    startOutlineGeneration,
    customThemeData,
    themeDataByTheme,
    generatedThemeData,
    pageStyle,
    presentationStyle,
    textContent,
    tone,
    audience,
    scenario,
    pageBackground,
    selectedSlideTemplates,
    setSelectedSlideTemplates,
    outlineItemIds,
    outlineTemplateOverrides,
    resetPresentationState,
  } = usePresentationState();

  useEffect(() => {
    setOutputFormat("flow");
  }, [setOutputFormat]);

  useEffect(() => {
    resetPresentationState();
  }, [resetPresentationState]);

  const typeFilter =
    documentTypeFilter === ALL_PRESENTATION_DOCUMENT_TYPES
      ? undefined
      : documentTypeFilter;
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [...PRESENTATIONS_QUERY_KEY, documentTypeFilter],
      queryFn: async ({ pageParam = 0 }) =>
        fetchPresentations(pageParam, typeFilter),
      getNextPageParam: (lastPage, allPages) =>
        lastPage.hasMore ? allPages.length : undefined,
      initialPageParam: 0,
    });
  const { ref: loadMoreRef } = useInView({
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
  });

  const allPresentations = data?.pages.flatMap((page) => page.items) ?? [];
  const fileItems: PresentationFileItem[] = allPresentations.map((item) => ({
    id: item.id,
    name: item.title || "Untitled",
    thumbnailUrl: item.thumbnailUrl,
    modified: formatDistanceToNow(new Date(item.updatedAt), {
      addSuffix: true,
    }),
    modifiedAt: new Date(item.updatedAt),
    isFavorited: item.favorites.length > 0,
    onClick: () => router.push(getPresentationRoute(item)),
  }));

  const selectedLanguageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ??
    "English";
  const slidesLabel =
    SLIDE_OPTIONS.find((option) => option.value === String(numSlides))?.label ??
    `${numSlides} slides`;
  const outputFormatLabel =
    getPresentationGenerationAspectRatioLabel(generationAspectRatio);
  const filterOptions = useMemo(
    () => [
      { id: ALL_PRESENTATION_DOCUMENT_TYPES, label: "All" },
      { id: "PRESENTATION", label: "Presentations" },
    ],
    [],
  );

  const handleGenerate = async () => {
    const prompt = presentationInput.trim();

    if (!prompt) {
      return;
    }

    const initialTheme = resolvedTheme === "dark" ? "ebony" : "mystique";
    const title = prompt.substring(0, 50) || "Untitled Presentation";

    setOutputFormat("flow");
    setIsGeneratingOutline(true);
    setTheme(initialTheme);

    const customization = buildPresentationCustomization({
      customThemeData,
      themeDataByTheme,
      generatedThemeData,
      theme: initialTheme,
      pageStyle,
      presentationStyle,
      generationAspectRatio,
      textContent,
      tone,
      audience,
      scenario,
      pageBackground,
      selectedSlideTemplates,
      outlineItemIds,
      outlineTemplateOverrides,
    });

    try {
      const result = await createEmptyPresentation({
        title,
        theme: initialTheme,
        language,
        customization,
      });

      if (!result.success || !result.presentation) {
        setIsGeneratingOutline(false);
        toast.error(result.message || "Failed to create presentation");
        return;
      }

      setCurrentPresentation(result.presentation.id, result.presentation.title);
      startOutlineGeneration();
      router.push(`/presentation/generate/${result.presentation.id}`);
    } catch (error) {
      setIsGeneratingOutline(false);
      console.error("Error creating presentation:", error);
      toast.error("Failed to create presentation");
    }
  };

  const slideLayoutsButton = (
    <button
      type="button"
      onClick={() => setIsTemplateModalOpen(true)}
      className="inline-flex h-7 items-center gap-1.5 px-0 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:h-9 sm:gap-2 sm:rounded-full sm:border sm:border-border sm:bg-background sm:px-4 sm:text-sm sm:text-foreground sm:hover:bg-accent"
    >
      <LayoutGrid className="size-4" />
      <span className="sm:hidden">Layouts</span>
      <span className="hidden sm:inline">Slide Layouts</span>
    </button>
  );

  return (
    <NotebookPageLayout>
      <GreetingSection />
      <OutlineTemplateModal
        isOpen={isTemplateModalOpen}
        mode="global"
        onClose={() => setIsTemplateModalOpen(false)}
      />

      <NotebookInputBox
        placeholder="Describe your topic or paste your content here. Our AI will structure it into a compelling presentation."
        value={presentationInput}
        onChange={setPresentationInput}
        onSubmit={handleGenerate}
        submitDisabled={!presentationInput.trim() || isGeneratingOutline}
        isSubmitting={isGeneratingOutline}
        topRightContent={slideLayoutsButton}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SettingPill icon={PanelsTopLeft} label={slidesLabel}>
            <DropdownMenuLabel>Slides</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={String(numSlides)}
              onValueChange={(value) => setNumSlides(Number(value))}
            >
              {SLIDE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </SettingPill>

          <SettingPill icon={LayoutTemplate} label={outputFormatLabel}>
            <DropdownMenuLabel>Format</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={generationAspectRatio}
              onValueChange={(value) =>
                setGenerationAspectRatio(
                  value as PresentationGenerationAspectRatio,
                )
              }
            >
              <DropdownMenuRadioItem value="dynamic">
                Dynamic
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="16:9">16:9</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </SettingPill>

          <SettingPill icon={Languages} label={selectedLanguageLabel}>
            <DropdownMenuLabel>Language</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
              {LANGUAGE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </SettingPill>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent sm:h-9 sm:px-3.5 sm:text-sm"
              >
                <WandSparkles className="size-3.5 sm:size-4" />
                More
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuCheckboxItem
                checked={webSearchEnabled}
                onCheckedChange={setWebSearchEnabled}
              >
                <Globe className="size-4" />
                Web Search
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={autoThemeEnabled}
                onCheckedChange={setAutoThemeEnabled}
              >
                <WandSparkles className="size-4" />
                Auto Theme
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ModelPicker shouldShowLabel={false} />

          {selectedSlideTemplates.length > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedSlideTemplates([])}
              className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3 text-[13px] font-medium text-foreground hover:bg-accent sm:h-9 sm:text-sm"
            >
              <LayoutGrid className="size-4" />
              {selectedSlideTemplates.length} layouts
              <X className="size-3.5" />
            </button>
          ) : null}

        </div>
      </NotebookInputBox>

      <PresentationProjectFilesSection
        files={fileItems}
        isLoading={isLoading}
        onCreateNew={() => {
          if (!isCreatingBlank) {
            void handleCreateBlank();
          }
        }}
        filterOptions={filterOptions}
        activeFilterId={documentTypeFilter}
        onFilterChange={(filterId) =>
          setDocumentTypeFilter(filterId as PresentationDocumentTypeFilterValue)
        }
      />

      {hasNextPage ? (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isFetchingNextPage ? (
            <div className="size-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          ) : null}
        </div>
      ) : null}
    </NotebookPageLayout>
  );
}
