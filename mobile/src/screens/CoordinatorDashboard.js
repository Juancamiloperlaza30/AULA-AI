import {
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';

import ProfileDashboardHeader
	from '../components/ProfileDashboardHeader';

export default function CoordinatorDashboard({
	usuario,
	apiUrl,
	accessToken,
	onLogout,
	onRegisterUser,
	onManageSubjects,
	onManagePeriods,
	onMyCommunications,
	onPublishCommunication,
}) {
	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={
				styles.contentContainer
			}
			showsVerticalScrollIndicator={false}
		>
			<ProfileDashboardHeader
				key={usuario?.id}
				apiUrl={apiUrl}
				accessToken={accessToken}
			/>

			<View style={styles.card}>
				<Text style={styles.cardTitle}>
					Gestión académica
				</Text>

				<Text style={styles.cardText}>
					Supervisión de materias, grupos y procesos académicos.
				</Text>
			</View>

			<View style={styles.card}>
				<Text style={styles.cardTitle}>
					Indicadores institucionales
				</Text>

				<Text style={styles.cardText}>
					Consulta de información general y seguimiento académico.
				</Text>
			</View>

			<TouchableOpacity
				style={styles.card}
				onPress={onRegisterUser}
			>
				<Text style={styles.cardTitle}>
					Gestión de usuarios
				</Text>

				<Text style={styles.cardText}>
					Registrar usuarios autorizados de la institución.
				</Text>
			</TouchableOpacity>

			<TouchableOpacity
				style={styles.card}
				onPress={onManageSubjects}
			>
				<Text style={styles.cardTitle}>
					Gestión de materias
				</Text>

				<Text style={styles.cardText}>
					Crear, consultar y asignar materias.
				</Text>
			</TouchableOpacity>

			<TouchableOpacity
				style={styles.card}
				onPress={onManagePeriods}
			>
				<Text style={styles.cardTitle}>
					Periodos académicos
				</Text>

				<Text style={styles.cardText}>
					Configura las fechas de inicio y finalización
					de los periodos académicos.
				</Text>
			</TouchableOpacity>

			{/* HU-12 | PUBLICAR COMUNICADO */}
			{typeof onPublishCommunication === 'function' && (
			  <TouchableOpacity
			    style={styles.card}
			    onPress={onPublishCommunication}
			    activeOpacity={0.85}
			    accessibilityRole="button"
			    accessibilityLabel="Publicar comunicado institucional"
			  >
			    <Text style={styles.cardTitle}>
			      📝 Publicar comunicado
			    </Text>
			    <Text style={styles.cardText}>
			      Redactar y enviar comunicados institucionales
			      a los destinatarios autorizados.
			    </Text>
			  </TouchableOpacity>
			)}

			{typeof onMyCommunications === 'function' && (
				<TouchableOpacity
					style={styles.card}
					onPress={onMyCommunications}
					activeOpacity={0.85}
					accessibilityRole="button"
					accessibilityLabel="Consultar mis comunicados institucionales"
				>
					<Text style={styles.cardTitle}>
						📢 Mis comunicados
					</Text>

					<Text style={styles.cardText}>
						Consulta los avisos, novedades y comunicados
						institucionales dirigidos a ti.
					</Text>
				</TouchableOpacity>
			)}

			<TouchableOpacity
				style={styles.logoutButton}
				onPress={onLogout}
			>
				<Text style={styles.logoutText}>
					Cerrar sesión
				</Text>
			</TouchableOpacity>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F5F7FA',
	},

	contentContainer: {
		padding: 24,
		paddingTop: 70,
		paddingBottom: 50,
	},

	card: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		padding: 18,
		marginBottom: 16,
		borderWidth: 1,
		borderColor: '#E0E6ED',
	},

	cardTitle: {
		fontSize: 17,
		fontWeight: 'bold',
		color: '#1F4E79',
		marginBottom: 6,
	},

	cardText: {
		fontSize: 14,
		color: '#455A64',
	},

	logoutButton: {
		marginTop: 30,
		backgroundColor: '#B3261E',
		paddingVertical: 14,
		borderRadius: 10,
		alignItems: 'center',
	},

	logoutText: {
		color: '#FFFFFF',
		fontWeight: 'bold',
		fontSize: 16,
	},
});
