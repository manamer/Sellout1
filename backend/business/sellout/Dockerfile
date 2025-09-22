# Imagen base
FROM openjdk:17-jdk-alpine

# Crear grupo y usuario no root
RUN addgroup -S sellout && adduser -S admin -G sellout

# Cambiar al usuario no root
USER admin:sellout

# Copiar el JAR a la imagen
COPY target/sellout-1.0.jar /app.jar

# Variable opcional para pasar opciones a la JVM
ENV JAVA_OPTS=""

# Ejecutar la aplicación
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Djava.security.egd=file:/dev/./urandom -jar /app.jar"]
