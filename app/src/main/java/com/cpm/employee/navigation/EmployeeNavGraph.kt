package com.cpm.employee.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.cpm.employee.EmployeeViewModel
import com.cpm.employee.ui.screens.AuthScreens
import com.cpm.employee.ui.screens.CallDetailsScreen
import com.cpm.employee.ui.screens.CallHistoryScreen
import com.cpm.employee.ui.screens.HomeScreen
import com.cpm.employee.ui.screens.ProfileScreen
import com.cpm.employee.ui.screens.SettingsScreen
import com.cpm.employee.ui.screens.SyncScreen
import com.cpm.employee.ui.screens.SplashScreen

object EmployeeRoutes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val HOME = "home"
    const val CALLS = "calls"
    const val CALL_DETAILS = "call/{callId}"
    const val SYNC = "sync"
    const val PROFILE = "profile"
    const val SETTINGS = "settings"

    fun callDetails(callId: String) = "call/$callId"
}

@Composable
fun EmployeeNavGraph(
    viewModel: EmployeeViewModel,
    navController: NavHostController = rememberNavController()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState.isAuthenticated) {
        if (uiState.isAuthenticated) {
            navController.navigate(EmployeeRoutes.HOME) {
                popUpTo(EmployeeRoutes.LOGIN) { inclusive = true }
            }
        }
    }

    NavHost(navController = navController, startDestination = EmployeeRoutes.SPLASH) {
        composable(EmployeeRoutes.SPLASH) {
            SplashScreen {
                navController.navigate(EmployeeRoutes.LOGIN) {
                    popUpTo(EmployeeRoutes.SPLASH) { inclusive = true }
                }
            }
        }
        composable(EmployeeRoutes.LOGIN) {
            AuthScreens.LoginScreen(
                errorMessage = uiState.loginError,
                isLoggingIn = uiState.isLoggingIn,
                onCredentialsChanged = viewModel::clearLoginError,
                onLogin = viewModel::login
            )
        }
        composable(EmployeeRoutes.HOME) {
            HomeScreen(
                employee = uiState,
                navController = navController,
                onNavigate = { route -> navController.navigate(route) }
            )
        }
        composable(EmployeeRoutes.CALLS) {
            CallHistoryScreen(
                calls = uiState.callRecords,
                filter = uiState.filter,
                searchQuery = uiState.searchQuery,
                onFilterChanged = viewModel::setCallFilter,
                onSearchChanged = viewModel::setSearchQuery,
                onCallSelected = { navController.navigate(EmployeeRoutes.callDetails(it)) },
                navController = navController
            )
        }
        composable(
            route = EmployeeRoutes.CALL_DETAILS,
            arguments = listOf(navArgument("callId") { type = NavType.StringType })
        ) { entry ->
            val call = uiState.callRecords.firstOrNull {
                it.id == entry.arguments?.getString("callId")
            }
            CallDetailsScreen(
                call = call,
                navController = navController
            )
        }
        composable(EmployeeRoutes.SYNC) {
            SyncScreen(
                state = uiState,
                onManageCallLogSettings = { navController.navigate(EmployeeRoutes.SETTINGS) },
                navController = navController
            )
        }
        composable(EmployeeRoutes.PROFILE) {
            ProfileScreen(
                employee = uiState,
                navController = navController
            )
        }
        composable(EmployeeRoutes.SETTINGS) {
            SettingsScreen(
                state = uiState,
                onNotificationsChanged = viewModel::setNotificationsEnabled,
                onCallSummaryChanged = viewModel::setCallSummaryEnabled,
                onAutoSyncChanged = viewModel::setAutoSyncEnabled,
                onCallLogConsentChanged = viewModel::setCallLogConsent,
                onCallLogPermissionChanged = viewModel::setCallLogPermissionGranted,
                onRefreshCallLogPermission = viewModel::refreshCallLogPermission,
                onChangePassword = viewModel::changePassword,
                onClearPasswordChangeStatus = viewModel::clearPasswordChangeStatus,
                onLogout = {
                    viewModel.logout()
                    navController.navigate(EmployeeRoutes.LOGIN) {
                        popUpTo(EmployeeRoutes.HOME) { inclusive = true }
                    }
                },
                navController = navController
            )
        }
    }
}
