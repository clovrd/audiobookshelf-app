FROM nginx:alpine

# Static app
COPY index.html styles.css app.js manifest.json sw.js /usr/share/nginx/html/
COPY vendor/ /usr/share/nginx/html/vendor/
COPY fonts/ /usr/share/nginx/html/fonts/
COPY icons/ /usr/share/nginx/html/icons/

# Server config (correct caching for the service worker / app shell)
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
