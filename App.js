import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { Image } from "react-native";

import DetailScreen from "./DetailScreen";
import FriendsScreen from "./FriendsScreen";
import HomeScreen from "./HomeScreen";
import ProfileScreen from "./ProfileScreen";
import WatchlistScreen from "./WatchlistScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Descubrir" component={HomeScreen} />
      <Stack.Screen name="Detalle" component={DetailScreen} />
    </Stack.Navigator>
  );
}
function WatchlistStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Quiero ver" component={WatchlistScreen} />
      <Stack.Screen name="Detalle" component={DetailScreen} />
    </Stack.Navigator>
  );
}
function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Perfil" component={ProfileScreen} />
      <Stack.Screen name="Detalle" component={DetailScreen} />
    </Stack.Navigator>
  );
}

const Icon = ({ src, focused }) => (
  <Image
    source={src}
    style={{ width: 35, height: 35, marginTop: 20, opacity: focused ? 1 : 0.5 }}
    resizeMode="contain"
    onError={(e) => console.log("Icon error:", e.nativeEvent.error)}
  />
);

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarStyle: { height: 70 },
          tabBarLabelStyle: { fontWeight: "600" },
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStack}
          options={{
            tabBarLabel: "",
            tabBarIcon: ({ focused }) => (
              <Icon
                focused={focused}
                src={require("./assets/splash.png")}
              />
            ),
          }}
        />
        <Tab.Screen
          name="WatchlistTab"
          component={WatchlistStack}
          options={{
            tabBarLabel: "",
            tabBarIcon: ({ focused }) => (
              <Icon
                focused={focused}
                src={require("./assets/listas.png")}
              />
            ),
          }}
        />
        <Tab.Screen
          name="FriendsTab"
          component={FriendsScreen}
          options={{
            tabBarLabel: "",
            tabBarIcon: ({ focused }) => (
              <Icon
                focused={focused}
                src={require("./assets/lupa.png")}
              />
            ),
          }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileStack}
          options={{
            tabBarLabel: "",
            tabBarIcon: ({ focused }) => (
              <Icon
                focused={focused}
                src={require("./assets/perfil.png")}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
