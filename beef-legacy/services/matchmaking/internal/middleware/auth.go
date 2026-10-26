package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/beefmobile/matchmaking/internal/config"
	"github.com/beefmobile/matchmaking/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const UserContextKey = "user"

// JWTAuth is middleware for validating JWT tokens
func JWTAuth(cfg config.JWTConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Parse and validate token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Verify signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("invalid signing method")
			}
			return []byte(cfg.Secret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		// Extract claims
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token claims"})
			c.Abort()
			return
		}

		// Extract user information
		user := models.User{
			ID:       claims["sub"].(string),
			Username: claims["username"].(string),
			MMR:      int(claims["mmr"].(float64)),
		}

		// Store user in context
		c.Set(UserContextKey, user)
		c.Next()
	}
}

// GetUserFromContext extracts the user from the Gin context
func GetUserFromContext(c *gin.Context) (*models.User, error) {
	value, exists := c.Get(UserContextKey)
	if !exists {
		return nil, errors.New("user not found in context")
	}

	user, ok := value.(models.User)
	if !ok {
		return nil, errors.New("invalid user type in context")
	}

	return &user, nil
}
