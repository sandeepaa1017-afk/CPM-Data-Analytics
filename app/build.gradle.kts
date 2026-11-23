plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val apiBaseUrl = providers.gradleProperty("CPM_API_BASE_URL")
    .orElse(providers.environmentVariable("CPM_API_BASE_URL"))
    .getOrElse("http://10.0.2.2:8000/api")
val releaseStoreFile = providers.environmentVariable("CPM_RELEASE_STORE_FILE").orNull
val releaseStorePassword = providers.environmentVariable("CPM_RELEASE_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("CPM_RELEASE_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("CPM_RELEASE_KEY_PASSWORD").orNull
val releaseSigningConfigured = listOf(
    releaseStoreFile,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword,
).all { !it.isNullOrBlank() }

android {
    namespace = "com.cpm.employee"
    compileSdk = 35

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.cpm.employee"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "CPM_API_BASE_URL", "\"$apiBaseUrl\"")
    }

    if (releaseSigningConfigured) {
        signingConfigs {
            create("release") {
                storeFile = file(requireNotNull(releaseStoreFile))
                storePassword = requireNotNull(releaseStorePassword)
                keyAlias = requireNotNull(releaseKeyAlias)
                keyPassword = requireNotNull(releaseKeyPassword)
            }
        }
    }

    buildTypes {
        getByName("release") {
            if (releaseSigningConfigured) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

tasks.matching {
    it.name in setOf(
        "assembleRelease",
        "bundleRelease",
        "packageRelease",
        "installRelease",
        "validateSigningRelease",
    )
}.configureEach {
    doFirst {
        if (!releaseSigningConfigured) {
            throw GradleException(
                "Set CPM_RELEASE_STORE_FILE, CPM_RELEASE_STORE_PASSWORD, " +
                    "CPM_RELEASE_KEY_ALIAS, and CPM_RELEASE_KEY_PASSWORD to build a signed release."
            )
        }
        if (!apiBaseUrl.startsWith("https://", ignoreCase = true)) {
            throw GradleException("Set CPM_API_BASE_URL to the HTTPS production API URL.")
        }
        if (!file("google-services.json").exists()) {
            throw GradleException("Add the production Firebase google-services.json before release.")
        }
    }
}
