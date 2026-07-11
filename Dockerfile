# ===========================
# Etapa de compilación
# ===========================
FROM node:22-bookworm AS builder

WORKDIR /app

# Variables que Dokploy enviará durante el build
ARG NEXT_PUBLIC_BACK_URL
ARG NEXT_PUBLIC_FRONT_URL
ARG NEXT_PUBLIC_BASIC_USER
ARG NEXT_PUBLIC_BASIC_PASS

# Las convertimos en variables de entorno para Next.js
ENV NEXT_PUBLIC_BACK_URL=$NEXT_PUBLIC_BACK_URL
ENV NEXT_PUBLIC_FRONT_URL=$NEXT_PUBLIC_FRONT_URL
ENV NEXT_PUBLIC_BASIC_USER=$NEXT_PUBLIC_BASIC_USER
ENV NEXT_PUBLIC_BASIC_PASS=$NEXT_PUBLIC_BASIC_PASS

COPY package*.json ./

RUN npm install

COPY . .

# (Opcional, para verificar en los logs del build)
RUN echo "NEXT_PUBLIC_BACK_URL=$NEXT_PUBLIC_BACK_URL"
RUN echo "NEXT_PUBLIC_FRONT_URL=$NEXT_PUBLIC_FRONT_URL"

RUN npm run build

# ===========================
# Etapa de ejecución
# ===========================
FROM node:22-bookworm

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm install --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

ENV TZ=America/Argentina/Buenos_Aires
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone
    

CMD ["npm", "start"]
