import java.util.Properties

plugins {
    id("com.android.application")
}

// Пароли от ключа лежат в keystore.properties рядом с проектом, в git не попадают.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "ru.hexblast.game"
    compileSdk = 35

    signingConfigs {
        if (keystoreProperties.isNotEmpty()) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    defaultConfig {
        applicationId = "ru.hexblast.game"
        minSdk = 26
        // 34, а не 35: на 35 Android принудительно рисует приложение под системными
        // панелями, и игре пришлось бы самой обходить вырезы и полоски.
        targetSdk = 34
        versionCode = 13
        versionName = "1.12"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
