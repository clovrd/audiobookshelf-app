#!/usr/bin/env bash
# Renames series logos to the file names the kids UI loads (<slug>.png, see KIDS.md "Series logos") and converts
# other image formats to PNG. Name each file after the series first, e.g. "Bibi & Tina.jpg" -> bibi-tina.png.
#
# Usage: scripts/kids-logos.sh [-n] [-k] [-f] [-s SIZE] <folder>
#   -n       dry run, only print what would happen
#   -k       keep the original files after converting (default: remove them)
#   -f       overwrite existing target files (default: skip them)
#   -s SIZE  shrink images larger than SIZE×SIZE px (keeps the aspect ratio, never enlarges), e.g. -s 512
#
# Needs perl (slugs) and ImageMagick (`magick` or `convert`) for anything that isn't a PNG already.
set -euo pipefail

dry_run=0 keep=0 force=0 size=''
while getopts 'nkfs:h' opt; do
  case $opt in
    n) dry_run=1 ;;
    k) keep=1 ;;
    f) force=1 ;;
    s) size=$OPTARG ;;
    *) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
  esac
done
shift $((OPTIND - 1))
dir=${1:?"Usage: $0 [-n] [-k] [-f] [-s SIZE] <folder>"}
[ -d "$dir" ] || { echo "Not a folder: $dir" >&2; exit 1; }
[[ -z $size || $size =~ ^[0-9]+$ ]] || { echo "-s needs a number of pixels" >&2; exit 1; }

# Same rules as seriesSlug() in utils/kids.js
slug() {
  perl -CSA -Mutf8 -MUnicode::Normalize -e '
    my $s = lc $ARGV[0];
    my %t = ("ä" => "ae", "ö" => "oe", "ü" => "ue", "ß" => "ss", "æ" => "ae", "ø" => "oe", "å" => "aa");
    $s =~ s/([äöüßæøå])/$t{$1}/g;
    $s = NFD($s);
    $s =~ s/\p{Mn}//g;
    $s =~ s/[^a-z0-9]+/-/g;
    $s =~ s/^-+|-+$//g;
    print $s;
  ' "$1"
}

magick_cmd=''
if command -v magick >/dev/null; then
  magick_cmd=magick
elif command -v convert >/dev/null; then
  magick_cmd=convert
fi

renamed=0 converted=0 skipped=0 unchanged=0
shopt -s nullglob nocaseglob
for src in "$dir"/*.{png,jpg,jpeg,webp,gif,bmp,tif,tiff,heic,heif,avif,svg}; do
  file=$(basename "$src")
  name=${file%.*}
  ext=${file##*.}
  ext=${ext,,}
  target_name="$(slug "$name").png"
  target="$dir/$target_name"

  if [ "$target_name" = '.png' ]; then
    echo "skip     $file (no letters or digits in the name)"
    skipped=$((skipped + 1)); continue
  fi
  needs_convert=0
  [[ $ext != png || -n $size ]] && needs_convert=1
  if [[ $file == "$target_name" && $needs_convert == 0 ]]; then
    unchanged=$((unchanged + 1)); continue
  fi
  # Another file already has this name (a case-only rename of the same file is fine)
  if [[ -e $target && ! $src -ef $target && $force == 0 ]]; then
    echo "skip     $file -> $target_name (exists, -f to overwrite)"
    skipped=$((skipped + 1)); continue
  fi

  if [ $needs_convert = 0 ]; then
    echo "rename   $file -> $target_name"
    if [ $dry_run = 0 ]; then
      # Via a temporary name so case-only renames work on case-insensitive file systems too
      tmp="$dir/.kids-logos-$$.png"
      mv -- "$src" "$tmp" && mv -f -- "$tmp" "$target"
    fi
    renamed=$((renamed + 1)); continue
  fi

  if [ -z "$magick_cmd" ]; then
    echo "skip     $file (install ImageMagick to convert it)"
    skipped=$((skipped + 1)); continue
  fi
  echo "convert  $file -> $target_name${size:+ (max ${size}px)}"
  if [ $dry_run = 0 ]; then
    args=()
    # SVGs: transparent background and enough resolution for a sharp raster
    [ "$ext" = svg ] && args+=(-background none -density 384)
    input="$src"
    # Animated GIFs and multi-page TIFFs: first frame only
    [[ $ext == gif || $ext == tif || $ext == tiff ]] && input="$src[0]"
    out=(-auto-orient)
    [ -n "$size" ] && out+=(-resize "${size}x${size}>")
    tmp="$dir/.kids-logos-$$.png"
    if "$magick_cmd" "${args[@]}" "$input" "${out[@]}" "PNG32:$tmp"; then
      mv -f -- "$tmp" "$target"
      [[ $keep == 0 && ! $src -ef $target ]] && rm -- "$src"
    else
      rm -f -- "$tmp"
      echo "failed   $file" >&2
      skipped=$((skipped + 1)); continue
    fi
  fi
  converted=$((converted + 1))
done

[ $dry_run = 1 ] && echo "(dry run, nothing changed)"
echo "renamed: $renamed, converted: $converted, skipped: $skipped, already fine: $unchanged"
